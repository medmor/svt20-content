# SVT20 Daily Content

Daily job that generates and publishes SVT20 (2BAC) educational content: a quiz (from a deduplication script), plus a definition and flashcard (from chapter content), then pushes to GitHub.

## Schedule

- **Cron:** `0 10 * * *` (daily at 10:00)
- **Timezone:** Africa/Casablanca
- **Session:** `session:daily-content`
- **Model:** ollama/minimax-m2.7:cloud

## Steps

### Step 1: Run the quiz script

```bash
cd /home/medmor/Documents/Projects/svt/svt20-content && node scripts/generate-daily-content.cjs
```

This script picks a random deduplicated MCQ and writes it to `daily-content.json` with empty `def_term`, `def_text`, `flash_front`, and `flash_back` fields.

If the script fails (all questions used), report that and stop. No new questions available.

### Step 2: Read the generated quiz

Read `/home/medmor/Documents/Projects/svt/svt20-content/daily-content.json` to see the quiz that was picked. Note the `quiz_unit` value (e.g., "unit1", "unit3sp", "unit4", etc.).

### Step 3: Map unit key to chapter directory

Use this mapping:

| JSON unit key | Chapter directory |
|---------------|-------------------|
| unit1         | unit-1            |
| unit2         | unit-2            |
| unit3         | unit-3            |
| unit3sp       | unit-3-sp-        |
| unit4         | unit-4            |
| unit5         | unit-5            |
| unit6         | unit-6            |

### Step 4: Read chapter content

List all `.html` files (NOT `.fiche.html`) in:

```
/home/medmor/Documents/Projects/svt/svt20-content/chapters/2-bac/{chapter-dir}/
```

Read ALL of them carefully to understand the unit's content.

### Step 5: Create a definition

Based on the chapter content, pick ONE important scientific term/concept from the unit. Write:

- `def_term`: The term name (e.g., "Pool génétique")
- `def_text`: A clear, precise 1-2 sentence definition in French. Must be scientifically accurate and directly pulled from the chapter content.

### Step 6: Create a flashcard

Pick ONE key question about the unit content. Write:

- `flash_front`: The question in French (e.g., "Quelles sont les conditions de la loi de Hardy-Weinberg ?")
- `flash_back`: The complete answer in French, accurate and based on chapter content

### Step 7: Update daily-content.json

Edit the file at `/home/medmor/Documents/Projects/svt/svt20-content/daily-content.json` to fill in `def_term`, `def_text`, `flash_front`, and `flash_back` with the content you created.

Keep the existing quiz fields unchanged.

### Step 8: Save history

Copy the final `daily-content.json` to:

```
/home/medmor/Documents/Projects/svt/svt20-content/daily-content-history/{YYYY-MM-DD}.json
```

Use today's date (e.g., `2026-06-22.json`).

### Step 9: Commit and push to GitHub

```bash
cd /home/medmor/Documents/Projects/svt/svt20-content
git add daily-content.json
git commit -m "daily content $(date +%Y-%m-%d)"
git push origin main
```

### Step 10: Report what was published

Summarize the quiz, definition, and flashcard.

## Delivery

- **Mode:** announce
- **Best effort:** true

## Timeout

300 seconds

## Notes

- Only Git push is required. NO Facebook posting.
- The quiz fields (`quiz_question`, `quiz_option_a` through `quiz_option_d`, `quiz_answer`) must not be modified — only the definition and flashcard fields are filled in.
- Always validate the JSON is well-formed after editing `daily-content.json` before committing.
