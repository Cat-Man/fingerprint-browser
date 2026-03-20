use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
  net::TcpStream,
  thread,
  time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tungstenite::{connect, stream::MaybeTlsStream, Message, WebSocket};

const PROBE_READY_TIMEOUT: Duration = Duration::from_secs(20);
const PROBE_POLL_INTERVAL: Duration = Duration::from_millis(250);

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunDetectionProbeRequest {
  pub profile_id: String,
  pub target_id: String,
  pub target_url: String,
  pub ws_endpoint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectionProbeResult {
  pub observed: ProbeObservedValues,
  pub artifacts: Vec<DetectionProbeArtifact>,
  pub captured_at: String,
  pub target_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DetectionProbeArtifact {
  pub id: String,
  pub url: String,
  pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProbeObservedValues {
  pub user_agent: String,
  pub language: String,
  pub timezone: String,
  pub webrtc: String,
  pub canvas: String,
  pub webgl: String,
  pub audio: String,
  pub client_rects: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TargetArtifactRequest {
  pub id: String,
  pub url: String,
}

struct CdpClient {
  socket: WebSocket<MaybeTlsStream<TcpStream>>,
  next_id: u64,
}

#[tauri::command]
pub fn run_detection_probe(
  request: RunDetectionProbeRequest,
) -> Result<DetectionProbeResult, String> {
  let mut client = CdpClient::connect(&request.ws_endpoint)?;
  let target_id = client.create_target(&request.target_url)?;

  let result = (|| -> Result<DetectionProbeResult, String> {
    let session_id = client.attach_to_target(&target_id)?;
    client.enable_page(&session_id)?;
    client.wait_for_document_ready(&session_id)?;

    let payload = client.evaluate(&session_id, build_probe_expression())?;
    let observed = extract_probe_observed_values(&payload)?;
    let artifacts =
      client.collect_target_artifacts(&session_id, &request.target_id, &request.target_url);

    Ok(DetectionProbeResult {
      observed,
      artifacts,
      captured_at: iso_timestamp(),
      target_url: request.target_url.clone(),
    })
  })()
  .map_err(|error| {
    format!(
      "failed to run {} probe for {}: {}",
      request.target_id, request.profile_id, error
    )
  });

  let _ = client.close_target(&target_id);

  result
}

pub(crate) fn extract_probe_observed_values(payload: &Value) -> Result<ProbeObservedValues, String> {
  serde_json::from_value(payload["result"]["result"]["value"].clone())
    .map_err(|error| format!("invalid probe payload: {error}"))
}

pub(crate) fn extract_probe_artifact_text(
  payload: &Value,
  id: &str,
  url: &str,
) -> Result<DetectionProbeArtifact, String> {
  let text = payload["result"]["result"]["value"]
    .as_str()
    .map(ToOwned::to_owned)
    .ok_or_else(|| "CDP evaluate did not return artifact text".to_string())?;

  Ok(DetectionProbeArtifact {
    id: id.to_string(),
    url: url.to_string(),
    text,
  })
}

pub(crate) fn build_target_artifact_plan(
  target_id: &str,
  target_url: &str,
) -> Option<Vec<TargetArtifactRequest>> {
  match target_id {
    "creepjs" => Some(vec![TargetArtifactRequest {
      id: "creepjs-main".to_string(),
      url: target_url.to_string(),
    }]),
    "browserleaks" => {
      let base_url = target_url.trim_end_matches('/');
      Some(vec![
        TargetArtifactRequest {
          id: "javascript".to_string(),
          url: format!("{base_url}/javascript"),
        },
        TargetArtifactRequest {
          id: "webrtc".to_string(),
          url: format!("{base_url}/webrtc"),
        },
        TargetArtifactRequest {
          id: "canvas".to_string(),
          url: format!("{base_url}/canvas"),
        },
        TargetArtifactRequest {
          id: "webgl".to_string(),
          url: format!("{base_url}/webgl"),
        },
        TargetArtifactRequest {
          id: "rects".to_string(),
          url: format!("{base_url}/rects"),
        },
      ])
    }
    _ => None,
  }
}

impl CdpClient {
  fn connect(ws_endpoint: &str) -> Result<Self, String> {
    let (socket, _) = connect(ws_endpoint)
      .map_err(|error| format!("failed to connect to CDP websocket: {error}"))?;

    Ok(Self { socket, next_id: 0 })
  }

  fn create_target(&mut self, target_url: &str) -> Result<String, String> {
    let response = self.send_command(
      "Target.createTarget",
      json!({
        "url": target_url,
      }),
      None,
    )?;

    response["result"]["targetId"]
      .as_str()
      .map(ToOwned::to_owned)
      .ok_or_else(|| "CDP createTarget did not return a targetId".to_string())
  }

  fn attach_to_target(&mut self, target_id: &str) -> Result<String, String> {
    let response = self.send_command(
      "Target.attachToTarget",
      json!({
        "targetId": target_id,
        "flatten": true,
      }),
      None,
    )?;

    response["result"]["sessionId"]
      .as_str()
      .map(ToOwned::to_owned)
      .ok_or_else(|| "CDP attachToTarget did not return a sessionId".to_string())
  }

  fn enable_page(&mut self, session_id: &str) -> Result<(), String> {
    self.send_command("Page.enable", json!({}), Some(session_id))?;
    Ok(())
  }

  fn wait_for_document_ready(&mut self, session_id: &str) -> Result<(), String> {
    let deadline = Instant::now() + PROBE_READY_TIMEOUT;

    loop {
      let ready_state = self.evaluate_string(session_id, "document.readyState")?;

      if ready_state == "complete" || ready_state == "interactive" {
        return Ok(());
      }

      if Instant::now() >= deadline {
        return Err("timed out waiting for the probe page to finish loading".to_string());
      }

      thread::sleep(PROBE_POLL_INTERVAL);
    }
  }

  fn navigate_to(&mut self, session_id: &str, target_url: &str) -> Result<(), String> {
    let response = self.send_command(
      "Page.navigate",
      json!({
        "url": target_url,
      }),
      Some(session_id),
    )?;

    if let Some(error_text) = response["result"]["errorText"].as_str() {
      return Err(format!("CDP navigate failed: {error_text}"));
    }

    self.wait_for_document_ready(session_id)
  }

  fn evaluate_string(&mut self, session_id: &str, expression: &str) -> Result<String, String> {
    let response = self.evaluate(session_id, expression)?;

    response["result"]["result"]["value"]
      .as_str()
      .map(ToOwned::to_owned)
      .ok_or_else(|| "CDP evaluate did not return a string value".to_string())
  }

  fn evaluate(&mut self, session_id: &str, expression: &str) -> Result<Value, String> {
    let response = self.send_command(
      "Runtime.evaluate",
      json!({
        "expression": expression,
        "awaitPromise": true,
        "returnByValue": true,
      }),
      Some(session_id),
    )?;

    if !response["result"]["exceptionDetails"].is_null() {
      return Err(format!(
        "probe evaluation failed: {}",
        response["result"]["exceptionDetails"]
      ));
    }

    Ok(response)
  }

  fn close_target(&mut self, target_id: &str) -> Result<(), String> {
    self.send_command(
      "Target.closeTarget",
      json!({
        "targetId": target_id,
      }),
      None,
    )?;

    Ok(())
  }

  fn collect_target_artifacts(
    &mut self,
    session_id: &str,
    target_id: &str,
    target_url: &str,
  ) -> Vec<DetectionProbeArtifact> {
    let Some(plan) = build_target_artifact_plan(target_id, target_url) else {
      return Vec::new();
    };

    plan
      .into_iter()
      .filter_map(|artifact| self.collect_target_artifact(session_id, &artifact).ok())
      .collect()
  }

  fn collect_target_artifact(
    &mut self,
    session_id: &str,
    artifact: &TargetArtifactRequest,
  ) -> Result<DetectionProbeArtifact, String> {
    self.navigate_to(session_id, &artifact.url)?;

    let payload = self.evaluate(session_id, build_artifact_expression())?;
    extract_probe_artifact_text(&payload, &artifact.id, &artifact.url)
  }

  fn send_command(
    &mut self,
    method: &str,
    params: Value,
    session_id: Option<&str>,
  ) -> Result<Value, String> {
    self.next_id += 1;

    let mut payload = json!({
      "id": self.next_id,
      "method": method,
      "params": params,
    });

    if let Some(session_id) = session_id {
      payload["sessionId"] = Value::String(session_id.to_string());
    }

    self
      .socket
      .send(Message::Text(payload.to_string().into()))
      .map_err(|error| format!("failed to send CDP command {method}: {error}"))?;

    self.read_response(self.next_id)
  }

  fn read_response(&mut self, expected_id: u64) -> Result<Value, String> {
    loop {
      let message = self
        .socket
        .read()
        .map_err(|error| format!("failed to read CDP response: {error}"))?;

      match message {
        Message::Text(text) => {
          let payload: Value = serde_json::from_str(&text)
            .map_err(|error| format!("invalid CDP JSON payload: {error}"))?;

          if payload["id"].as_u64() == Some(expected_id) {
            if let Some(error) = payload.get("error") {
              return Err(format!("CDP command error: {error}"));
            }

            return Ok(payload);
          }
        }
        Message::Ping(payload) => {
          self
            .socket
            .send(Message::Pong(payload))
            .map_err(|error| format!("failed to respond to CDP ping: {error}"))?;
        }
        Message::Close(_) => {
          return Err("CDP websocket closed unexpectedly".to_string());
        }
        Message::Binary(_) | Message::Pong(_) | Message::Frame(_) => {}
      }
    }
  }
}

fn iso_timestamp() -> String {
  let seconds = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_secs();

  format!("{seconds}")
}

fn build_probe_expression() -> &'static str {
  r#"
    (async () => {
      const hashString = (input) => {
        let hash = 0
        for (let index = 0; index < input.length; index += 1) {
          hash = Math.imul(31, hash) + input.charCodeAt(index) | 0
        }
        return `h${(hash >>> 0).toString(16)}`
      }

      const safeRun = async (handler) => {
        try {
          return await handler()
        } catch (error) {
          return `error:${error instanceof Error ? error.message : String(error)}`
        }
      }

      const canvas = await safeRun(async () => {
        const canvasElement = document.createElement('canvas')
        canvasElement.width = 240
        canvasElement.height = 60
        const context = canvasElement.getContext('2d')

        if (!context) {
          return 'unavailable'
        }

        context.fillStyle = '#101820'
        context.fillRect(0, 0, canvasElement.width, canvasElement.height)
        context.font = '16px serif'
        context.fillStyle = '#f2aa4c'
        context.fillText('fingerprint-browser', 8, 32)

        return hashString(canvasElement.toDataURL())
      })

      const webgl = await safeRun(async () => {
        const canvasElement = document.createElement('canvas')
        const context =
          canvasElement.getContext('webgl') ||
          canvasElement.getContext('experimental-webgl')

        if (!context) {
          return 'unavailable'
        }

        const debugInfo = context.getExtension('WEBGL_debug_renderer_info')
        const vendor = debugInfo
          ? context.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
          : context.getParameter(context.VENDOR)
        const renderer = debugInfo
          ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          : context.getParameter(context.RENDERER)

        return `${vendor} / ${renderer}`
      })

      const audio = await safeRun(async () => {
        const AudioContextCtor =
          window.OfflineAudioContext || window.webkitOfflineAudioContext

        if (!AudioContextCtor) {
          return 'unavailable'
        }

        const context = new AudioContextCtor(1, 5000, 44100)
        const oscillator = context.createOscillator()
        const gain = context.createGain()

        oscillator.type = 'triangle'
        oscillator.frequency.value = 10000
        gain.gain.value = 0.05

        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(0)

        const rendered = await context.startRendering()
        const fingerprint = Array.from(rendered.getChannelData(0).slice(0, 32))
          .map((value) => value.toFixed(5))
          .join(',')

        return hashString(fingerprint)
      })

      const clientRects = await safeRun(async () => {
        const probe = document.createElement('div')
        probe.textContent = 'fingerprint-browser'
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;font-size:13.37px;'
        ;(document.body || document.documentElement).appendChild(probe)

        const rectSummary = Array.from(probe.getClientRects())
          .map((rect) => `${rect.width.toFixed(2)}x${rect.height.toFixed(2)}`)
          .join(',')

        probe.remove()
        return rectSummary || 'none'
      })

      return {
        userAgent: navigator.userAgent || '',
        language: navigator.language || navigator.languages?.[0] || '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        webrtc: typeof RTCPeerConnection === 'undefined' ? 'disabled' : 'enabled',
        canvas,
        webgl,
        audio,
        clientRects,
      }
    })()
  "#
}

fn build_artifact_expression() -> &'static str {
  r#"
    (() => {
      const text = document.body?.innerText || ''
      return text.slice(0, 12000)
    })()
  "#
}
