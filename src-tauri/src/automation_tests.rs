use crate::automation::{
  build_target_artifact_plan, extract_probe_artifact_text, extract_probe_observed_values,
  DetectionProbeArtifact, ProbeObservedValues,
};
use serde_json::json;

#[test]
fn extracts_probe_observed_values_from_runtime_evaluate_payload() {
  let payload = json!({
    "result": {
      "result": {
        "value": {
          "userAgent": "Probe UA",
          "language": "en-US",
          "timezone": "Asia/Shanghai",
          "webrtc": "enabled",
          "canvas": "canvas-hash",
          "webgl": "webgl-hash",
          "audio": "audio-sum",
          "clientRects": "rects-hash"
        }
      }
    }
  });

  let observed = extract_probe_observed_values(&payload).expect("payload should parse");

  assert_eq!(
    observed,
    ProbeObservedValues {
      user_agent: "Probe UA".to_string(),
      language: "en-US".to_string(),
      timezone: "Asia/Shanghai".to_string(),
      webrtc: "enabled".to_string(),
      canvas: "canvas-hash".to_string(),
      webgl: "webgl-hash".to_string(),
      audio: "audio-sum".to_string(),
      client_rects: "rects-hash".to_string(),
    }
  );
}

#[test]
fn rejects_probe_payloads_missing_required_fields() {
  let payload = json!({
    "result": {
      "result": {
        "value": {
          "userAgent": "Probe UA",
          "language": "en-US"
        }
      }
    }
  });

  let error = extract_probe_observed_values(&payload).expect_err("payload should be rejected");

  assert!(error.contains("timezone"), "unexpected error: {error}");
}

#[test]
fn builds_browserleaks_artifact_plan() {
  let artifacts = build_target_artifact_plan("browserleaks", "https://browserleaks.com/")
    .expect("plan should exist");

  assert_eq!(artifacts.len(), 5);
  assert_eq!(artifacts[0].id, "javascript");
  assert_eq!(artifacts[4].url, "https://browserleaks.com/rects");
}

#[test]
fn extracts_probe_artifact_text_from_runtime_evaluate_payload() {
  let payload = json!({
    "result": {
      "result": {
        "value": "Canvas Fingerprint\nSignature\tABCDEF"
      }
    }
  });

  let artifact = extract_probe_artifact_text(
    &payload,
    "canvas",
    "https://browserleaks.com/canvas",
  )
  .expect("artifact should parse");

  assert_eq!(
    artifact,
    DetectionProbeArtifact {
      id: "canvas".to_string(),
      url: "https://browserleaks.com/canvas".to_string(),
      text: "Canvas Fingerprint\nSignature\tABCDEF".to_string(),
    }
  );
}
