use crate::automation::{extract_probe_observed_values, ProbeObservedValues};
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
