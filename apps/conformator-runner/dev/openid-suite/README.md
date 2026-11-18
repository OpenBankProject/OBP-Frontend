# The OpenID conformance suite, for the runner

The runner hands FAPI and OpenID Connect checks of a participant's authorisation server to the OpenID Foundation's conformance suite, through the suite's REST API. A test asks for it with a `check` step:

```json
{
  "steps": [
    {
      "kind": "check",
      "name": "FAPI 2.0 security profile",
      "check": "openid:plan",
      "with": {
        "plan": "fapi2-security-profile-final-test-plan",
        "variant": { "sender_constrain": "mtls", "client_auth_type": "mtls", "fapi_profile": "plain_fapi", "openid": "openid_connect" },
        "modules": ["fapi2-security-profile-final-discovery-end-point-verification"]
      }
    }
  ]
}
```

`plan` and `variant` are the suite's own names; its web pages list them when you create a plan. `modules` is optional: without it, every module of the plan runs.

## What the runner needs per system

The participant's configuration for the suite goes in `openid-config.json`, in the system's folder under `RUNNER_CREDENTIALS_DIR`, beside its other secrets. It is the JSON the suite asks for when you create a plan by hand: the server's discovery URL, two test clients with their keys and certificates, the resource endpoint, and the `browser` steps that log a test user in on the participant's own screens. The OpenID Foundation's instructions explain each field: <https://openid.net/certification/instructions/>.

## How the outcome is decided

- **pass**: every module the suite ran passed. Warnings pass, and are listed.
- **fail**: any module failed.
- **not executed**: a module needs a person to review it (the suite says REVIEW), so the regulator's reviewer decides this test.
- **blocked, harness side**: the suite cannot be reached, a module gave no verdict or was interrupted, every module was skipped, or the runner has no configuration for the system.

The plan's and each module's address in the suite are kept with the result as evidence.

## Running the suite locally

```bash
dev/openid-suite/start-openid-suite.sh        # clones release-v5.3.4, builds it, starts it with Docker
dev/openid-suite/start-openid-suite.sh stop
```

It needs git, a JDK 17 or later with Maven, and Docker. The script prints the two settings to put in the runner's `.env`. The suite's source and data stay in `dev/openid-suite/conformance-suite/`, which git ignores.
