# Codenames

A real-time multiplayer implementation of the classic board game Codenames, built with SvelteKit, Socket.IO, and Supabase.

## Tech Stack

- **Frontend**: SvelteKit 2 with Svelte 5 runes
- **Backend**: Express.js + Socket.IO
- **Database**: Supabase (PostgreSQL)
- **Styling**: TailwindCSS 4 with shadcn-svelte components

## Prerequisites

- Node.js 18+
- Supabase account (free tier works)
- npm or pnpm

## Setup

### 1. Install Dependencies

```sh
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to your project's SQL Editor
3. Run the schema file: `src/lib/server/schema.sql`
4. Get your project credentials from Settings > API

### 3. Configure Environment

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000
PUBLIC_URL=http://localhost:5173

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication
JWT_SECRET=your_secure_random_string
```

### 4. Development

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (frontend only) |
| `npm run dev:fullr` | start backend and frontend server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run preview` | Preview production build |

### Socket Events

**Room Events:**
- `room:create` - Create a new room
- `room:join` - Join existing room
- `room:leave` - Leave current room
- `room:changeTeam` - Switch teams
- `room:changeRole` - Become spymaster/operative

**Game Events:**
- `game:start` - Start the game (host only)
- `game:giveClue` - Spymaster gives clue
- `game:guessCard` - Operative guesses
- `game:endTurn` - End turn early
- `game:getState` - Refresh game state

## Deployment

The app uses `@sveltejs/adapter-node` and can be deployed to:
- Railway
- Fly.io
- DigitalOcean App Platform
- Any Node.js hosting with WebSocket support

## License

MIT
