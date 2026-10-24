# V17 — notifications, desktop gravity pop-up, profile skeleton, footer, dropdown

1. **Notification bell (all three dashboards).** Header bar on desktop (breadcrumb + bell), bell in the top bar on phones.
   Every message pop-up is also kept in the *browser only* (`localStorage`, one list per account, max 80). Nothing is
   saved on the server or in the database. Panel: Mark all read, Clear all, remove one, unread dots, badge count.
   Code: `lib/notifications.ts`, `portal/ui/NotificationBell.tsx`, `portal/ui/notifications.css`.
2. **Message pop-up = gravity box, DESKTOP ONLY (>= 981 px).** Drops from the top, bounces, settles bottom-right, shows
   a countdown line, falls away at the end (click it to drop it early). Phones/tablets keep the original pill pop-up.
3. **My profile skeleton** now has the same sections as the real page (photo card, public-page card, About you,
   Quick facts, Talents, Social media).
4. **Data view "Rows per page"** uses the site's own drop-down instead of the browser's dark list.
5. **Footer "Follow us"** is one card: heading + sentence on top, three named buttons underneath.
