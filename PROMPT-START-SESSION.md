# 🚀 פרומפט פתיחת שיחה עם Claude

> **איך להשתמש:**
> 1. פתחי שיחה חדשה ב-claude.ai
> 2. פתחי את הפרויקט בקרסר
> 3. תעתיקי את הפרומפט שלמטה (בתוך הבלוק) ותדביקי בקרסר
> 4. הקרסר יחזיר פלט מסודר
> 5. תעתיקי את הפלט ותדביקי בשיחה החדשה עם Claude
> 6. Claude יקבל את כל ההקשר מבלי שצריך לגרור קבצים

---

## הפרומפט (להעתקה לקרסר):

````
# Generate Claude Session Brief

I'm starting a new conversation with Claude about the Golan Towing project.
Read the planning folder and produce a comprehensive brief for Claude.

**Workflow:** READ ONLY. Don't modify any files. Just read and output.

## Files to read:
1. `_planning/README.md`
2. `_planning/00-master-plan.md`
3. `_planning/03-current-status.md`
4. Identify the current active stage from `03-current-status.md`, then read its detail file from `_planning/stages/`
5. If the current status mentions any other stages as context (dependencies, blockers), read those too

## Output format:

Produce a single Markdown brief structured exactly like this:

```
# 📋 Session Brief - Golan Towing

I'm starting a new session with you about Golan Towing.
Read this brief carefully - it contains everything you need to know about where we are.

## 🎯 Current Stage
[Name of current stage and its status]

## 📊 What's Done
[Bullet list from 03-current-status.md - completed items]

## ⏳ What's In Progress
[Bullet list - currently active items]

## 🚧 Next Tasks
[The next 1-3 tasks from the current stage's file]

## 📌 Open Questions / Notes
[Items from "Open Questions" section in 03-current-status.md]

## 🧠 Important Context
- Workflow with Cursor: READ ONLY diagnosis → focused single-file edits → npx tsc --noEmit → visual test → Eden commits manually
- Communication: Hebrew for explanations, English for Cursor prompts
- Tech stack: Next.js 14, TypeScript, Tailwind, Supabase, Vercel, RTL
- Three interfaces: admin dashboard, driver app, customer portal
- Multi-tenant SaaS (companies as tenants)

## 🗂️ Files I have access to in this project
- `_planning/` folder (excluded from git)
- Full source code

## 📚 Full Plan Reference
The full master plan has [N] stages total. See `_planning/00-master-plan.md` in my project for the complete roadmap.

---

**Please confirm you understand where we are, and let me know what you'd like to tackle.**
```

After producing the brief, also tell me:
- Word count of the brief
- Whether there are any inconsistencies you noticed between the planning files (e.g., a task marked done in one file but not another)

Don't make any changes. Just output the brief and any notes.
````

---

## איך זה עובד בפועל

1. **את:** פותחת שיחה חדשה בClaude + שולחת את הפרומפט הזה לקרסר
2. **הקרסר:** סורק את התיקייה, מייצר בריף מסודר
3. **את:** מעתיקה את הבריף מהקרסר ושולחת לי כאן
4. **אני (Claude):** מקבל את כל ההקשר ויכול לעבוד מיד

**יתרון:** אין צורך לגרור קבצים, אין סיכון לשכוח משהו, הבריף תמיד מבוסס על המצב העדכני של התיקייה.
