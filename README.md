# Paper Dispatch

A comprehensive exam paper allocation and dispatch management system designed for educational institutions to streamline the process of managing exam papers, college assignments, and administrative workflows.

## 🎯 Project Overview

Paper Dispatch is a modern web application that facilitates:

- **Exam Paper Management**: Create, organize, and manage exam papers
- **College Administration**: Manage colleges, batches, and administrative staff
- **Paper Allocation**: Efficiently allocate exam papers to colleges
- **Secure Dispatch**: Track and manage the secure distribution of exam papers
- **Role-based Access**: Separate interfaces for chairpersons and college administrators
- **Real-time Tracking**: Monitor paper downloads and distribution logs

## 👥 User Roles

### Chairperson
- Manage colleges and college administrators
- Create and manage exam papers
- Allocate papers to colleges
- Monitor system-wide activities and download logs
- Configure system settings

### College Administrator
- View assigned exam papers
- Download papers when available
- Update profile information
- Change password securely
- Track scheduled exams

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- Supabase account for backend services

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url> paper-dispatch
   cd paper-dispatch
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Configure your environment variables
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 🛠️ Technology Stack

This project is built with modern web technologies:

### Frontend
- **React 18** - Modern UI library with hooks
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Beautiful and accessible UI components
- **Lucide React** - Modern icon library

### Backend & Database
- **Supabase** - Backend-as-a-Service platform
- **PostgreSQL** - Robust relational database
- **Row Level Security (RLS)** - Database-level security
- **Edge Functions** - Serverless functions for secure operations

### Authentication & Security
- **Supabase Auth** - Secure user authentication
- **Role-based Access Control** - Granular permission system
- **JWT Tokens** - Secure session management

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── layout/         # Layout components (Header, Sidebar)
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom React hooks
├── integrations/       # External service integrations
├── lib/                # Utility functions
└── pages/              # Application pages
    ├── Dashboard.tsx   # Main dashboard
    ├── Colleges.tsx    # College management
    ├── Papers.tsx      # Paper management
    ├── Allocations.tsx # Paper allocation
    └── Profile.tsx     # User profile management
```

## 🔐 Security Features

- **Role-based Authentication**: Separate access levels for chairpersons and college admins
- **Secure Password Management**: Encrypted password storage and secure reset functionality
- **Session Management**: Automatic session handling with JWT tokens
- **Data Validation**: Client and server-side input validation
- **Audit Logging**: Track all paper downloads and system activities

## 🚀 Deployment

### Frontend on Vercel

The repository is ready for Vercel: `vercel.json` sets the build, serves every app route
(`/dashboard/...`, `/about`, …) from `index.html`, caches hashed assets for a year and adds
security headers.

1. In Vercel, **Add New → Project** and import this GitHub repository.
2. Vercel reads `vercel.json` (install `npm ci`, build `npm run build`, output `dist`). Leave the defaults.
3. Under **Environment Variables**, add these (current values are in `.env`; see `.env.example`):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_PROJECT_ID` | your Supabase project ref |
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | the Supabase publishable key |

   These are public browser values; data is protected by row-level security.
4. Deploy. Every push to `main` redeploys automatically.

### Backend on Supabase

Database changes and edge functions are deployed from your machine with the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push            # apply new migrations
npx supabase functions deploy   # deploy all edge functions
```

In the Supabase dashboard, turn off **Authentication → Sign In / Providers → Allow new users
to sign up**: accounts are created by the university only.

### Local development

```bash
npm ci
npm run dev      # http://localhost:8080
npm run build    # production build in dist/
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author

**Made with ❤️ by Parth D. Joshi**

---

*For support or questions, please contact the development team.*
