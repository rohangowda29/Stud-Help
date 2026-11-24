"""AWS Lambda handler for POST /sync.

Body: {"deviceId": str, "events": [{"learnerId": str, "t": ms, "skill": str, "level": int, "correct": bool}]}
Each event is stored in DynamoDB (partition key learnerId, sort key ts).
Returns the latest content pack version so devices know when to download a new one.
Only random IDs are stored. Children's names never leave the device.
"""
import json
import os

import boto3

TABLE = boto3.resource("dynamodb").Table(os.environ.get("TABLE_NAME", "progress"))
CONTENT_VERSION = int(os.environ.get("CONTENT_VERSION", "1"))
MAX_EVENTS = 200


def _response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body),
    }


def handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _response(204, {})
    try:
        body = json.loads(event.get("body") or "{}")
        device = str(body.get("deviceId", ""))[:64]
        events = body["events"][:MAX_EVENTS]
        with TABLE.batch_writer() as batch:
            for e in events:
                batch.put_item(Item={
                    "learnerId": str(e["learnerId"])[:64],
                    "ts": int(e["t"]),
                    "skill": str(e["skill"]),
                    "level": int(e["level"]),
                    "correct": bool(e["correct"]),
                    "deviceId": device,
                })
    except (KeyError, ValueError, TypeError):
        return _response(400, {"error": "Expected a list of events with learnerId, t, skill, level, correct"})
    return _response(200, {"saved": len(events), "contentVersion": CONTENT_VERSION})