# TeamTracker

Co-ed soccer team management app built with React Native (Expo) and Firebase.

## Features

- **Dashboard** — Season overview, record, form streak, top performers
- **Games** — Match results with multi-keeper support, game details
- **Players** — Field and keeper stats, dual-role players
- **Seasons** — Season history with standings, promotion/relegation tracking
- **Settings** — Team name per season, role-based access control

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- A Firebase project (free Spark plan is sufficient)

## Setup

### 1. Clone and install

```bash
cd TeamTracker
npm install
```

### 2. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use existing)
3. Enable **Authentication** → Sign-in methods → Google + Email/Password
4. Create a **Firestore Database** in production mode
5. Copy your web app config into `src/config/firebase.ts`

### 3. Deploy security rules and indexes

```bash
npm install -g firebase-tools
firebase login
firebase init  # select Firestore, point to existing files
firebase deploy --only firestore:rules,firestore:indexes
```

### 4. Run the app

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone, or press:
- `i` for iOS simulator
- `a` for Android emulator
- `w` for web browser

## Project Structure

```
TeamTracker/
├── App.tsx                          # Entry point
├── firestore.rules                  # Security rules
├── firestore.indexes.json           # Composite indexes
└── src/
    ├── config/
    │   └── firebase.ts              # Firebase initialization
    ├── types/
    │   └── index.ts                 # TypeScript interfaces
    ├── theme/
    │   └── index.ts                 # Colors, spacing, radii
    ├── hooks/
    │   ├── useAuth.tsx              # Auth context + role management
    │   └── useFirestore.ts          # Real-time data subscriptions
    ├── services/
    │   ├── firestore.ts             # CRUD operations
    │   └── utils.ts                 # Stats, formatting helpers
    ├── navigation/
    │   └── AppNavigator.tsx         # Bottom tab navigator
    └── screens/
        ├── DashboardScreen.tsx      # Fully implemented dashboard
        └── PlaceholderScreens.tsx   # Games, Players, Seasons, Settings stubs
```

## Roles

| Role    | Read | Write Games/Players | Write Seasons | Manage Members |
|---------|------|--------------------:|:-------------:|:--------------:|
| viewer  | ✓    | ✗                   | ✗             | ✗              |
| editor  | ✓    | ✓                   | ✗             | ✗              |
| admin   | ✓    | ✓                   | ✓             | ✓              |

## Deploying to Vercel (Recommended)

The easiest way to get this in your teammates' hands — just a URL they open on any phone.

### One-time setup

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create TeamTracker --private --push
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click "Add New Project" → import your TeamTracker repo
   - Vercel will auto-detect the `vercel.json` config
   - Click "Deploy" — that's it

3. **Your app is live** at `https://teamtracker-XXXX.vercel.app`
   - You can add a custom domain later in Vercel's dashboard
   - Every `git push` auto-deploys

### Sharing with your team

Send the URL to your teammates. They can:
- **iPhone**: Open in Safari → Share → "Add to Home Screen" (app icon, fullscreen, no browser bar)
- **Android**: Open in Chrome → Menu → "Add to Home Screen" or "Install app"

It looks and feels like a native app once added to the home screen.

### Local development

```bash
npm run web        # Dev server with hot reload
npm run build:web  # Production build (outputs to dist/)
```

## Next Steps

1. Fill in `src/config/firebase.ts` with your project credentials
2. Deploy Firestore rules: `firebase deploy --only firestore:rules,firestore:indexes`
3. Push to GitHub and connect to Vercel
4. Build out the placeholder screens using the prototype as reference
5. Share the URL with your team

## Architecture

See `TeamTracker-Firebase-Architecture.docx` for the full data model,
security rules explanation, query patterns, and implementation roadmap.
