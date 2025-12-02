# Video Calling Frontend

Next.js frontend for the video calling application.

## Setup

```bash
npm install
```

Create `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

Open http://localhost:3000

## Features

- Clean Google Meet-inspired UI
- Landing page with meeting creation
- Video room with LiveKit integration
- Responsive design
- TypeScript + Tailwind CSS

## Pages

- `/` - Landing page (create/join meeting)
- `/room/[roomId]` - Video room

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- LiveKit Components React
- Lucide React (icons)

---

See main [README.md](../../README.md) for complete setup.
