# Dentist-Project
25-2 창의개발랩 수업

## Deploying this `after/` site

This folder contains the static site for the DentCharlie simulation UI.

Two easy ways to deploy:

1) Vercel (recommended for simple deployments)
- Sign in to Vercel with your GitHub account.
- Import the repository and when prompted for the root, set the `Root Directory` to `after`.
- Vercel will detect a static site and deploy automatically on pushes.

2) GitHub Pages (configured via GitHub Actions)
- A workflow exists at `.github/workflows/deploy-after.yml` that publishes the `after/` folder to GitHub Pages on pushes to `main`.
- Ensure the repository's Pages settings (in GitHub) are set to serve from the `gh-pages` branch (the action will create/update it).

Notes
- If you prefer another host (Netlify, Surge), you can point it at the `after/` folder similarly.
- For Vercel, if you want custom domains or HTTPS, use Vercel's dashboard.

Troubleshooting
- If pages don't appear, check Actions -> Workflows for failures and review logs.
- Make sure `images/` and other assets are within `after/` so they're published.
