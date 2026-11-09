# Kubernetes Deployment Guide

This guide covers deploying the OBP Portal to Kubernetes with proper environment variable configuration.

## Environment Variables in Kubernetes

### ConfigMap Example

Create a ConfigMap for non-sensitive configuration:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: obp-portal-config
  namespace: default
data:
  # Core Configuration
  PUBLIC_OBP_BASE_URL: "https://api.example.com"
  ORIGIN: "https://portal.example.com"
  
  # OAuth Configuration
  OAUTH_ISSUER_URL: "https://auth.example.com"
  APP_CALLBACK_URL: "https://portal.example.com/api/auth/callback"
  
  # External Links
  PUBLIC_API_EXPLORER_URL: "https://apiexplorer.example.com"
  PUBLIC_API_MANAGER_URL: "https://apimanager.example.com"
  PUBLIC_SUBSCRIPTIONS_URL: "https://subscriptions.example.com"
  
  # UI Customization
  PUBLIC_LOGO_URL: "/logo.png"
  PUBLIC_DARK_LOGO_URL: "/logo-dark.png"
  PUBLIC_LOGO_WIDTH: "200px"
  
  # Sponsor Configuration
  PUBLIC_SPONSOR_NOTE: "Sponsored by Example Corp"
  PUBLIC_SPONSOR_IMAGE: "https://example.com/sponsor-logo.png"
  PUBLIC_SPONSOR_DARK_IMAGE: "https://example.com/sponsor-logo-dark.png"
  PUBLIC_SPONSOR_INFO_URL: "https://sponsor.example.com"
  
  # About Page (for short content)
  PUBLIC_ABOUT_TEXT: |
    # About Our Banking Portal
    
    Welcome to our custom banking portal built on the Open Bank Project.
    
    ## Features
    - API Access
    - Developer Tools
    - Comprehensive Documentation
  
  # Redis Configuration
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  
  # Opey Integration
  OPEY_URL: "http://opey-service:5000"
  # The Portal's own focus for Opey, appended after Opey's per-instance OPEY_SUPPLEMENTARY_PROMPT
  # (or OPEY_APP_SUPPLEMENTARY_PROMPT_FILE, e.g. a mounted ConfigMap)
  # OPEY_APP_SUPPLEMENTARY_PROMPT: "Focus on helping developers find and call the APIs."
  
  # Analytics
  ENABLE_ANALYTICS: "false"
  
  # Feature Flags
  # Note: In SvelteKit, PUBLIC_ env vars are always strings (not booleans)
  # Accepts: "true", "TRUE", "True", "1" to enable
  PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: "true"
```

### Secret Example

Create a Secret for sensitive data:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: obp-portal-secrets
  namespace: default
type: Opaque
stringData:
  # OAuth Credentials
  OAUTH_CLIENT_ID: "your-client-id"
  OAUTH_CLIENT_SECRET: "your-client-secret"
  
  # Session Secret (generate with: openssl rand -hex 32)
  SESSION_SECRET: "your-generated-secret-here"
  
  # Redis Password (if using authentication)
  REDIS_PASSWORD: "your-redis-password"
  
  # Opey API Key
  OPEY_API_KEY: "your-opey-api-key"
  
  # Analytics
  GTAG_ID: "G-XXXXXXXXXX"
```

### Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: obp-portal
  namespace: default
  labels:
    app: obp-portal
spec:
  replicas: 2
  selector:
    matchLabels:
      app: obp-portal
  template:
    metadata:
      labels:
        app: obp-portal
    spec:
      containers:
      - name: obp-portal
        image: your-registry/obp-portal:latest
        ports:
        - containerPort: 3000
          name: http
        envFrom:
        # Load all ConfigMap values as environment variables
        - configMapRef:
            name: obp-portal-config
        # Load all Secret values as environment variables
        - secretRef:
            name: obp-portal-secrets
        # You can also set individual env vars:
        env:
        - name: NODE_ENV
          value: "production"
        # Or override specific values
        - name: ORIGIN
          value: "https://portal.example.com"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: obp-portal-service
  namespace: default
spec:
  selector:
    app: obp-portal
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: obp-portal-ingress
  namespace: default
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - portal.example.com
    secretName: obp-portal-tls
  rules:
  - host: portal.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: obp-portal-service
            port:
              number: 80
```

## Environment Variables in SvelteKit

**Important:** In SvelteKit, all `PUBLIC_*` environment variables are exposed to the client as **strings**, not booleans. Even if you set them as booleans in Kubernetes YAML, they are converted to strings.

### Truthy String Values (all work)
- `"true"` (string)
- `"TRUE"` (string)
- `"True"` (string)
- `"1"` (string)

### Falsy Values
- `"false"` (string)
- `"FALSE"` (string)
- `"0"` (string)
- Unset/empty

### Example in Kubernetes

```yaml
# All of these will enable the feature (converted to strings by SvelteKit):
PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: true      # YAML boolean → becomes string "true"
PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: "true"    # String (explicit)
PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: "TRUE"    # String
PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: "True"    # String
PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: "1"       # String

# All of these will disable the feature:
PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: false     # YAML boolean → becomes string "false"
PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: "false"   # String (explicit)
PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: "FALSE"   # String
PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: "0"       # String
# PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: ""      # Commented out / unset
```

**Recommendation:** Use unquoted `true`/`false` in Kubernetes YAML for cleaner syntax. SvelteKit will convert them to strings automatically.

## Using ConfigMap from File

For longer content like the About page, create a ConfigMap from a file:

```bash
# Create about-content.md
cat > about-content.md << 'EOF'
# About Our Banking Portal

Your full markdown content here...
EOF

# Create ConfigMap from file
kubectl create configmap obp-portal-about \
  --from-file=PUBLIC_ABOUT_TEXT=about-content.md \
  --namespace=default

# Reference in Deployment
apiVersion: apps/v1
kind: Deployment
# ...
spec:
  template:
    spec:
      containers:
      - name: obp-portal
        envFrom:
        - configMapRef:
            name: obp-portal-config
        - configMapRef:
            name: obp-portal-about
        - secretRef:
            name: obp-portal-secrets
```

## Helm Chart Example

If using Helm, create a `values.yaml`:

```yaml
replicaCount: 2

image:
  repository: your-registry/obp-portal
  tag: "latest"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: portal.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: obp-portal-tls
      hosts:
        - portal.example.com

env:
  # Public environment variables
  PUBLIC_OBP_BASE_URL: "https://api.example.com"
  ORIGIN: "https://portal.example.com"
  PUBLIC_API_EXPLORER_URL: "https://apiexplorer.example.com"
  PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: "true"

secrets:
  # Sensitive environment variables
  OAUTH_CLIENT_ID: "your-client-id"
  OAUTH_CLIENT_SECRET: "your-client-secret"
  SESSION_SECRET: "your-session-secret"

resources:
  requests:
    memory: 256Mi
    cpu: 100m
  limits:
    memory: 512Mi
    cpu: 500m
```

## Deployment Commands

```bash
# Apply ConfigMap
kubectl apply -f configmap.yaml

# Apply Secrets
kubectl apply -f secrets.yaml

# Apply Deployment
kubectl apply -f deployment.yaml

# Check deployment status
kubectl get deployments -n default
kubectl get pods -n default

# View logs
kubectl logs -f deployment/obp-portal -n default

# Check environment variables in pod
kubectl exec -it <pod-name> -n default -- env | grep -E "(PUBLIC_|OAUTH_)"

# Update ConfigMap and rollout restart
kubectl apply -f configmap.yaml
kubectl rollout restart deployment/obp-portal -n default

# Monitor rollout
kubectl rollout status deployment/obp-portal -n default
```

## Troubleshooting

### Environment Variables Not Loading

1. **Check ConfigMap exists:**
```bash
kubectl get configmap obp-portal-config -n default -o yaml
```

2. **Check Secret exists:**
```bash
kubectl get secret obp-portal-secrets -n default
```

3. **Verify env vars in pod:**
```bash
kubectl exec -it <pod-name> -n default -- env
```

### Environment Variable Not Working

Remember that SvelteKit converts all `PUBLIC_*` variables to strings:
```yaml
# These all work (converted to strings):
PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: true      # YAML boolean → "true" string
PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: "true"    # String
PUBLIC_UNDOCUMENTED_FEATURE_1_ENABLED: "1"       # String

# Check the actual value being received:
kubectl exec -it <pod-name> -n default -- env | grep PUBLIC_UNDOCUMENTED
```

### App Not Starting

1. **Check pod logs:**
```bash
kubectl logs <pod-name> -n default
```

2. **Check pod events:**
```bash
kubectl describe pod <pod-name> -n default
```

3. **Verify required environment variables are set:**
- `ORIGIN`
- `PUBLIC_OBP_BASE_URL`
- `SESSION_SECRET`
- `OAUTH_CLIENT_ID`
- `OAUTH_CLIENT_SECRET`

## Security Best Practices

1. **Always use Secrets for sensitive data** (never ConfigMaps)
2. **Enable RBAC** to restrict access to Secrets
3. **Use encrypted etcd** in production
4. **Rotate secrets regularly**
5. **Use external secret managers** (e.g., Sealed Secrets, External Secrets Operator, HashiCorp Vault)
6. **Never commit secrets to git**
7. **Use least privilege** for service accounts

## Production Checklist

- [ ] All required environment variables set
- [ ] Secrets properly encrypted
- [ ] Resource limits configured
- [ ] Health checks configured
- [ ] Horizontal Pod Autoscaling configured (if needed)
- [ ] Ingress with TLS configured
- [ ] Monitoring and logging configured
- [ ] ORIGIN matches your domain
- [ ] APP_CALLBACK_URL matches your OAuth configuration
- [ ] Redis configured and accessible
- [ ] Multiple replicas for high availability

## Additional Resources

- [Kubernetes ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Environment Variables Documentation](./environment-variables.md)
- [Docker Deployment](./docker.md)