# intelligentworlds.ai

Static site for https://intelligentworlds.ai/ — plain HTML/CSS/JS from the repo
root, no build step. Extensionless URLs work (`/about` → `about.html`) via the
CloudFront function; keep links extensionless.

```sh
node scripts/dev-server.mjs   # http://localhost:8000/
```

Pushes to `main` deploy automatically (`.github/workflows/deploy.yml`): repo
root → S3 `prod-use1-websites-intelligentworlds-ai` → CloudFront invalidation.
Infra: `EdgeGamingGG/Terraform` → `environments/production/us-east-1/websites`.
