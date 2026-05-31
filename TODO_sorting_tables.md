# TODO: Click-to-sort tables (server-side)

## Backend
- [ ] Extend `GET /admin/users` to accept `sort_by` + `sort_dir` and apply safe `order_by`.
- [ ] Extend `GET /faq` to accept `sort_by` + `sort_dir` and apply safe `order_by` for filtered public FAQ list.

## Frontend
- [ ] Update `frontend/src/pages/manager/ManagerUsers.tsx`:
  - [ ] Add sortable header click UI (asc/desc toggle).
  - [ ] Send `sort_by` + `sort_dir` to `/admin/users`.
  - [ ] Reset `page` to 1 when sorting changes.
- [ ] Update `frontend/src/pages/admin/AdminFaqs.tsx`:
  - [ ] Remove local `sortedFaqs` logic.
  - [ ] Make table headers clickable with asc/desc toggle.
  - [ ] Send `sort_by` + `sort_dir` to `/faq`.

## Verification
- [ ] Run `npm run build` (frontend) and ensure no TS errors.
- [ ] Manually verify clicking each header toggles asc/desc and updates results.
