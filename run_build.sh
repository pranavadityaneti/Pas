source ~/.nvm/nvm.sh && nvm use default
cd apps/merchant-app
npx eas-cli build --platform all --profile production --non-interactive
