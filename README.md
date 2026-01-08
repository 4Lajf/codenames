# Codenames

A real-time multiplayer implementation of the classic board game Codenames, built with SvelteKit, Socket.IO, and Supabase.

## Features

- Real-time multiplayer gameplay
- Room-based matchmaking with shareable codes
- Team selection (Red vs Blue)
- Role-based views (Spymaster sees all, Operatives see revealed only)
- Complete game logic (clues, guessing, turn management)
- Persistent sessions with automatic reconnection

## Tech Stack

- **Frontend**: SvelteKit 5 with Svelte 5 runes
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

For frontend-only development (hot reload):
```sh
npm run dev
```

For full-stack development with Socket.IO:
```sh
npm run build
npm run start
```

Or in one command:
```sh
npm run dev:server
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (frontend only) |
| `npm run dev:server` | Build and start full server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run preview` | Preview production build |

## Architecture

### Backend Structure

```
src/lib/server/
├── auth.ts              # JWT token generation/verification
├── database.types.ts    # TypeScript types for DB tables
├── supabaseAdmin.ts     # Supabase client initialization
├── socket.ts            # Socket.IO server setup
├── schema.sql           # Database schema
├── seed-words.sql       # Word bank seed data
├── db/
│   └── index.ts         # Database operations
├── handlers/
│   ├── room.ts          # Room socket event handlers
│   ├── game.ts          # Game socket event handlers
│   └── broadcast.ts     # State broadcasting utilities
└── game/
    ├── cards.ts         # Card generation logic
    └── validation.ts    # Game rule validation
```

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

## Game Rules

1. **Setup**: 25 word cards in a 5x5 grid. First team has 9 agents, second has 8.
2. **Teams**: Red and Blue. Each needs a Spymaster and Operative(s).
3. **Gameplay**:
   - Spymaster gives one-word clue + number
   - Operatives guess cards (number + 1 bonus guess)
   - Correct: continue guessing
   - Wrong team/neutral: turn ends
   - Assassin: instant loss
4. **Win**: First team to find all agents, or opponent hits assassin

## Deployment

The app uses `@sveltejs/adapter-node` and can be deployed to:
- Railway
- Fly.io
- DigitalOcean App Platform
- Any Node.js hosting with WebSocket support

Remember to:
1. Set all environment variables
2. Run database migrations on Supabase
3. Ensure WebSocket connections are supported

## License

MIT
