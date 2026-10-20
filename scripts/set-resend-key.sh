#!/bin/zsh
# Stores the Resend API key in Supabase's secret vault without showing it on screen.
read -rs "K?Paste your Resend key (it won't show), then press Enter: "
echo
if [[ "$K" != re_* ]]; then echo "That doesn't look like a Resend key (it should start with re_). Nothing was saved."; exit 1; fi
~/.local/tools/supabase-cli/supabase secrets set --project-ref shuxpbwahivqjbldxmik RESEND_API_KEY="$K" >/dev/null && echo "✅ Saved. You can close this tab."
unset K
