# The Goted — Neo-Brutalism Second Brain

A personal second brain built with raw, unapologetic Neo-Brutalism design. One place to capture notes, ideas, code snippets, links, and files — all searchable, all yours.

## Features

- **Single Data Model**: Everything is just an "item" with type, category, tags, and content
- **Neo-Brutalism Design**: Thick borders, hard shadows, bold typography, high contrast
- **Real-time Search**: Filter by title, content, or tags
- **Category Organization**: Coding, UI/UX, Ideas, Links, Random
- **Type System**: Notes, Links, Code, Ideas, Files with color coding
- **Quick Capture**: Fast modal for dumping thoughts
- **Keyboard Shortcuts**: Ctrl+S to save, Ctrl+K to search, Esc to close modals

## Setup

1. **Supabase Database**: Create a new Supabase project and run this SQL:

```sql
create table items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  title text,
  type text,
  content text,
  tags text[],
  category text,
  status text default 'active',
  created_at timestamp default now()
);

alter table items enable row level security;

create policy "read own" on items
  for select using (user_id = auth.uid());

create policy "insert own" on items
  for insert with check (user_id = auth.uid());

create policy "update own" on items
  for update using (user_id = auth.uid());

create policy "delete own" on items
  for delete using (user_id = auth.uid());

-- Enable realtime for Collab feature
alter publication supabase_realtime add table items;
```

2. **Configure**: Update `app.js` with your Supabase URL and anon key

3. **Create User**: Add a user in Supabase Authentication panel

4. **Run**: Serve the files with any HTTP server:
   ```bash
   python -m http.server 8000
   # or
   npx serve .
   ```

## Design System

### Colors (Dark Theme)
- Background: `#0D0D0D` (near black)
- Surface: `#1A1A1A` (cards, panels)  
- Border: `#000000` (always true black)
- Text Primary: `#FFFFFF`
- Text Secondary: `#AAAAAA`

### Accents
- Yellow `#FFE500` (primary actions)
- Green `#00FF85` (notes)
- Blue `#0066FF` (links)
- Pink `#FF2D78` (ideas, danger)
- Orange `#FF6B00` (code)

### Typography
- Display: Space Grotesk 800
- UI Labels: IBM Plex Mono 400/700
- Code: JetBrains Mono 400

### Core Principles
- 3-4px black borders on everything
- Hard shadows: `4px 4px 0px #000` (no blur)
- Hover = element shifts: `translate(-2px, -2px)`
- Active = element depresses: `translate(2px, 2px)`
- 8px spacing grid
- High contrast always

## File Structure

```
mindvault/
├── index.html    # Main app structure
├── style.css     # Neo-Brutalism design system
├── app.js        # Supabase integration & logic
└── README.md     # This file
```

## Usage

1. **Login** with your Supabase user credentials
2. **Quick Capture** (+ ADD button) to dump ideas fast
3. **Browse** items in the list panel
4. **Edit** by clicking an item to load it in the editor
5. **Search** using the top search bar
6. **Filter** by category using the sidebar
7. **Tag** items for better organization

The mental model: everything goes into one place, one structure. Capture is fast, finding is instant.

---

Built with brutal honesty. No gradients hiding structure. No blur softening edges. Everything is what it is.