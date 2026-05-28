# 🏁 פרומפט סיום שיחה עם Claude

> **איך להשתמש:**
> 1. בסוף שיחה משמעותית עם Claude, מבקשים מ-Claude לכתוב סיכום עדכון
> 2. Claude יחזיר טקסט מסודר במבנה מסוים
> 3. תעתיקי את הסיכום + את הפרומפט שלמטה לקרסר
> 4. הקרסר יעדכן את הקבצים הרלוונטיים בתוך `_planning/`

---

## בקשה ל-Claude בסוף השיחה:

תכתבי ל-Claude:

```
תכין לי סיכום עדכון לקרסר. כתוב באנגלית, במבנה הסטנדרטי, כדי שהקרסר יעדכן את הקבצים בתיקיית _planning.
```

Claude יחזיר משהו כמו:

```yaml
session_summary:
  date: "2026-05-27"
  duration_topic: "Stage 1 - Quick Wins kickoff"

completed:
  - "Task 1.1: Distance calculation bug - unified calculateDistance functions, added lng to deps"
  - "Task 1.14: Indexes added to Supabase"

in_progress:
  - "Task 1.5: Dashboard getTows removal - 80% done, blocked on calendar refactor"

new_findings:
  - "Discovered additional realtime channel in app/dashboard/calendar that needs filter"

next_tasks:
  - "Task 1.6: Debounce realtime refresh"
  - "Task 1.7: Calendar SQL filter"

open_questions:
  - "Should we add an index on tow_legs(tow_id)? Not in original list."

notes:
  - "Eden encountered TypeScript error on attempt 2 of Task 1.1, resolved by..."
```

## הפרומפט (להעתקה לקרסר):

תעתיקי את הסיכום ש-Claude נתן לך, ואז הוסיפי את הפרומפט הזה:

````
# Update Planning Folder

Based on the session summary above, update the planning files in `_planning/`.

**Workflow:**
1. Show me your plan first - what files you'll edit and what changes
2. Make focused edits to each file
3. After all edits, show me a diff summary
4. STOP - I'll commit manually

## Files to update:

### 1. `_planning/03-current-status.md`
- Update "Last Updated" date to today
- Move items from `in_progress` → `completed` if they're in the `completed:` list
- Update `⏳ בעבודה כעת` to reflect new `in_progress:` items
- Add items from `next_tasks:` if relevant
- Add items from `open_questions:` to the "Open Questions" section
- Add any new context from `notes:` and `new_findings:`

### 2. `_planning/00-master-plan.md`
- If an entire stage is now complete, mark it with ✅ in the stage header
- If a stage status changed (e.g. ⏸️ → ⏳), update the status emoji
- Update "תאריך עדכון אחרון" at the top

### 3. The current stage file in `_planning/stages/`
- Check off completed items in the Checklist section (- [ ] → - [x])
- Add any new findings or notes in a "🔍 גילויים תוך כדי" section if not already there
- Update any task descriptions if they were refined during the session

## Important
- Keep Hebrew content in Hebrew
- Don't change task descriptions unless `notes:` explicitly mentions a change
- Preserve the file structure (don't reorganize, just update content)
- If `new_findings:` mentions something major that affects future stages, add a note in those stage files too

After completing, run:
```bash
git status _planning/
```
to show me what changed (these files are gitignored so won't actually be staged, but git status still shows them as untracked changes within the folder).

Don't commit. Don't push.
````

---

## איך זה עובד בפועל

1. **בסוף שיחה:** מבקשים מClaude סיכום עדכון מובנה
2. **Claude:** מייצר YAML/Markdown מסודר עם מה שנעשה ומה הלאה
3. **את:** מעתיקה את הסיכום + הפרומפט הזה לקרסר
4. **הקרסר:** מעדכן את הקבצים ב-`_planning/`

**יתרון:** הקבצים תמיד מעודכנים, ובשיחה הבאה הפרומפט של הפתיחה יתפוס את העדכונים אוטומטית.

---

## 💡 טיפ

עדיף לעדכן בסוף **כל שיחה משמעותית**, גם אם עשית רק חצי משימה. עדיף עדכון קטן ותכוף מאשר עדכון גדול שמשאיר חורים.
