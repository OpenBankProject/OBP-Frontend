# Deploying OBP-Cohort to Kubernetes

CI publishes the image `docker.io/<org>/obp-cohort` on every push to `main`, tagged with the commit sha, `main` and `latest`, and signs the `main` tag with cosign (`.github/workflows/build_container_image.yml`). Pin the commit sha tag in production. To build it yourself: `./build_cohort_image.sh` from the repository root.

The container serves HTTP on port 3000 and reads its configuration from environment variables when it starts, so one image serves any installation. Every variable is described in [`.env.example`](../.env.example).

## Before the first start

- **OBP-API** with Redis for sessions, reachable from the pod.
- **Cohort's OIDC client** at OBP-API, with the redirect `https://<cohort host>/login/obp/callback`.
- **Two spaces (bank ids)**, created once by an admin in the API Manager: Cohort's space (`OBP_ENTITY_SPACE_ID`, default `cohort`) and the forms space (`COHORT_FORMS_SPACE_ID`, default `cohort-forms`). Give the forms bank a full name such as "Cohort forms space".
- **Cohort's Consumer Scopes**, granted on the Platform Apps page. `/staff/setup` lists the ones still missing.

On start Cohort creates its dynamic entities, and keeps retrying every five minutes until the Scopes allow it, so no restart is needed after granting them.

## Replicas: run one

Reminders are sent by a timer inside the process. Two replicas would both send them, and the same reminder can go out twice. Run `replicas: 1`, or set `COHORT_REMINDER_INTERVAL_MINUTES: "0"` on all but one Deployment. Sessions live in Redis, so more replicas are otherwise fine.

## ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: obp-cohort-config
data:
  ORIGIN: "https://cohort.example.com"
  APP_CALLBACK_URL: "https://cohort.example.com/login/obp/callback"
  PUBLIC_OBP_BASE_URL: "https://api.example.com"

  OBP_ENTITY_SPACE_ID: "cohort"
  COHORT_FORMS_SPACE_ID: "cohort-forms"

  REDIS_HOST: "redis"
  REDIS_PORT: "6379"

  # Room for an applicant's document upload (up to 5 MB). The image already sets this.
  BODY_SIZE_LIMIT: "6M"
  COHORT_REMINDER_INTERVAL_MINUTES: "60"

  # Optional: Opey on the open calls page
  # OPEY_BASE_URL: "http://opey:5000"
  # PUBLIC_OPEY_BASE_URL: "https://opey.example.com"
  # OPEY_CONSUMER_ID: ""
  # Cohort's own focus for Opey, appended after Opey's per-instance prompt (or OPEY_APP_SUPPLEMENTARY_PROMPT_FILE)
  # OPEY_APP_SUPPLEMENTARY_PROMPT: "Answer as the programme office. Keep answers short."

  # Optional branding (each can also be set as a webui_prop in the API Manager, which wins)
  # COHORT_NAME: "Cohort"
  # COHORT_LOGO_URL: "/logo2x-1.png"
  # COHORT_THEME: "obptheme"
  # COHORT_STYLESHEET_URL: "https://brand.example.com/cohort.css"
```

## Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: obp-cohort-secrets
type: Opaque
stringData:
  # The server does not start without it. Generate with: openssl rand -hex 32
  SESSION_SECRET: ""
  OBP_OAUTH_CLIENT_ID: ""
  OBP_OAUTH_CLIENT_SECRET: ""
  REDIS_PASSWORD: ""
  # Optional further providers, used only if OBP-API lists them at its well-known endpoint
  # KEYCLOAK_OAUTH_CLIENT_ID: ""
  # KEYCLOAK_OAUTH_CLIENT_SECRET: ""
  # GOOGLE_OAUTH_CLIENT_ID: ""
  # GOOGLE_OAUTH_CLIENT_SECRET: ""
```

## Deployment, Service and Ingress

`/health` answers 200 while the process serves HTTP. It checks nothing else; `/staff/setup` shows whether OBP-API, the spaces and the Scopes are in order.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: obp-cohort
  labels:
    app: obp-cohort
spec:
  replicas: 1
  selector:
    matchLabels:
      app: obp-cohort
  template:
    metadata:
      labels:
        app: obp-cohort
    spec:
      containers:
        - name: obp-cohort
          image: docker.io/<org>/obp-cohort:<commit sha>
          ports:
            - containerPort: 3000
              name: http
          envFrom:
            - configMapRef:
                name: obp-cohort-config
            - secretRef:
                name: obp-cohort-secrets
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: obp-cohort
spec:
  selector:
    app: obp-cohort
  ports:
    - port: 80
      targetPort: http
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: obp-cohort
  annotations:
    # Uploads up to 5 MB go through the Ingress too
    nginx.ingress.kubernetes.io/proxy-body-size: "6m"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - cohort.example.com
      secretName: obp-cohort-tls
  rules:
    - host: cohort.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: obp-cohort
                port:
                  number: 80
```

`ORIGIN` must be the address people use (the Ingress host, with https). SvelteKit rejects form posts from any other origin, and the links in Cohort's emails are built from it.

## Checking the image signature

```bash
cosign verify --key cosign.pub docker.io/<org>/obp-cohort:main
```
