# annual-leave
Minimal NHS annual-leave / TOIL / study-leave tracker for one person, behind a secret URL. Live: https://annual-leave.technoir.cloud/m/<token>

## Commands
- Check (before every commit and deploy): `npm run check`
- Dev: `npm run dev` → http://localhost:3000/m/dev-token-0123456789
- Deploy: `./scripts/deploy.sh`; set or rotate the URL token: `./scripts/set-token-key.sh`

## Non-negotiables
1. Zero dependencies, no build step: Node stdlib server + plain ES modules in `public/`.
2. The token is the only access control. Never commit it, log it, or put it anywhere but the `TOKEN` env var.
3. Data is a single JSON doc in the `annual-leave-data` Swarm volume; keep one replica with stop-first updates, or two containers write over each other.
4. Leave maths lives only in `public/leave.js` (browser and tests share it). Bank holidays default to NHS Grampian 2026/27; Good Friday 2027 is an assumption.
