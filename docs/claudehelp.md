Fix the mobile emoji picker layout issue in SokoMw Chat.jsx.

Current issue:
On mobile, the emoji picker opens but the top/recent emoji section and bottom emoji category selection area are hidden or overlapped. The emoji grid is consuming the available height and covering other picker sections.

Investigate:
- src/pages/Chat.jsx emoji picker structure
- src/styles/chat-thread.css responsive emoji picker rules
- flex height calculations
- overflow behavior
- z-index stacking
- grid scrolling behavior

Implement a proper mobile emoji picker layout:

Required structure:

Emoji Picker Container
----------------------
Header
- Emoji title
- Current category
- Close button

Recent/Frequent Emoji Section
- Always visible when available
- Fixed height
- Does not get pushed away by the grid

Emoji Grid Section
- Takes remaining available space
- Scrolls internally only
- Must NOT overlap other sections

Category Selector
- Always visible at the bottom
- Fixed height
- Above the composer input
- Must never be hidden

Use proper flex layout:

picker:
display:flex;
flex-direction:column;

header:
flex:none;

recent row:
flex:none;

emoji grid:
flex:1;
min-height:0;
overflow-y:auto;

category navigation:
flex:none;


Mobile requirements:
- Picker must fit inside viewport.
- Do not allow content to go behind composer.
- Do not use absolute positioning that causes sections to overlap.
- Maintain the existing emoji insertion and cursor logic.
- Keep desktop unchanged.

Also check:
- z-index of picker
- bottom positioning above composer
- max-height calculations
- overflow:hidden causing clipping

After fixing:
Explain:
1. Root cause of the overlap.
2. CSS/layout changes made.
3. How the picker now allocates height between header, recent emojis, grid, and categories.
4. Run npm build.