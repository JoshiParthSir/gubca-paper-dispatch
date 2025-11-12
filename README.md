# GUBCA Paper Dispatch System

A comprehensive exam paper allocation and dispatch management system designed for educational institutions to streamline the process of managing exam papers, college assignments, and administrative workflows.

## 🎯 Project Overview

The GUBCA Paper Dispatch System is a modern web application that facilitates:

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
   git clone <repository-url>
   cd gubca-paper-dispatch
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

### Environment Variables

Create a `.env` file with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Build for Production

```bash
npm run build
```

### Deploy to Netlify/Vercel

The application can be easily deployed to modern hosting platforms:

1. Connect your repository to your hosting platform
2. Set the build command to `npm run build`
3. Set the publish directory to `dist`
4. Configure environment variables

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
