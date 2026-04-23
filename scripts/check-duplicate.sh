#!/usr/bin/env bash
# SVT20 Daily Content Deduplication Helper
# Usage: cd /home/medmor/Documents/Projects/svt/svt20-content && bash scripts/check-duplicate.sh "question text"
# Returns exit 0 if question is NEW, exit 1 if it was published in last 30 days

QUESTION="$1"
HISTORY_DIR="daily-content-history"
DAYS_BACK=30

if [ -z "$QUESTION" ]; then
    echo "Usage: check-duplicate.sh 'question text'"
    exit 2
fi

# Build list of recently used questions
RECENT_QUESTIONS=$(find "$HISTORY_DIR" -name "*.json" -mtime -$DAYS_BACK -exec grep -h '"quiz_question"' {} + | sed 's/.*"quiz_question": *"//;s/"$//')

# Check if question exists in recent history
if echo "$RECENT_QUESTIONS" | grep -Fxq "$QUESTION"; then
    echo "DUPLICATE: '$QUESTION' was published in last $DAYS_BACK days"
    exit 1
else
    echo "NEW: '$QUESTION' not found in last $DAYS_BACK days"
    exit 0
fi
