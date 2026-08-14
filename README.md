# SmartIntern

SmartIntern is a full-stack internship management platform designed to streamline internship discovery, application submission, and administrative oversight.

The system supports three primary roles:

- Students – browse listings, apply with resume uploads, track application status
- Companies – create and manage internship listings
- Administrators – oversee users, companies, listings, and applications

SmartIntern is built as a production-ready SaaS-style architecture with a separated frontend and backend, role-based access control, and secure document handling.

---

# SaaS Positioning

SmartIntern is architected as a scalable Software-as-a-Service (SaaS) platform suitable for institutions and organizations managing internship pipelines.

It is designed for:

- Educational institutions managing structured internship programs
- Enterprises hiring interns across departments
- Training providers coordinating placement workflows
- Organizations requiring controlled resume submissions

SmartIntern is not a simple job board.

It is a governed internship management system with:

- Role-based access control
- Administrative oversight
- Structured workflow states
- Secure document storage
- Backend-enforced permissions

The architecture supports horizontal scaling, isolated deployments, and future multi-tenant expansion.

---

# Core Features

### Student Portal

- Browse internship listings
- Search and filter by industry and remote availability
- Apply with resume upload (PDF/DOC/DOCX)
- View application status (Submitted, Reviewing, Shortlisted, Accepted, Rejected)
- Resume stored securely in Supabase Storage

### Company Portal

- Create internship listings
- Edit and manage listing details
- Control listing status (Draft, Open, Closed)
- Review applications received
- Update application status

### Admin Portal

- Create student and company accounts
- Activate / deactivate users
- Reset passwords
- Edit company information
- View platform-wide statistics
- View listings and applications across the system

---

# Listing Status Logic

- Draft → Hidden from students
- Open → Visible and available for application
- Closed → Visible but not available for new applications

This ensures transparency while preventing new submissions when a position is filled.

---

# Architecture

SmartIntern follows a separated architecture:

Frontend:

- Static deployment (Vercel)
- Vanilla JS modules
- Tailwind CSS via CDN

Backend:

- Node.js + Express
- RESTful API structure
- Deployed on Render

Database:

- Supabase (PostgreSQL)

Storage:

- Supabase Storage (resume uploads)

Authentication:

- Supabase Auth
- JWT-based role validation
- Server-side role enforcement

---

# Backend Structure

Routes include:

- /auth
- /me
- /public
- /student
- /company
- /admin

Security enforcement is handled through:

- requireAuth middleware
- requireRole validation
- Role checks against profiles table
- UUID validation
- Input validation and sanitization
- Duplicate application prevention (database constraint)

---

# Deployment Architecture

Frontend:

- Hosted on Vercel
- Environment variable:
  API_BASE_URL → Render backend URL

Backend:

- Hosted on Render
- Environment variables:
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  ALLOWED_ORIGIN
  PORT

Supabase:

- PostgreSQL database
- Auth provider
- Storage bucket for documents

---

# Security Considerations

- Service role key used only on backend
- Role-based authorization enforced server-side
- Resume uploads restricted by MIME type
- File size limit (5MB)
- Duplicate application protection
- Admin self-deactivation prevention
- Input validation on all mutating endpoints

---

# Scalability Design

SmartIntern is structured to support:

- Stateless backend scaling
- Independent frontend deployments
- Multi-environment configuration
- Potential future multi-tenant schema expansion

The separation of frontend and backend ensures independent scaling and deployment updates.

---

# Tech Stack

Frontend:

- HTML
- Tailwind CSS
- Vanilla JavaScript (ES Modules)

Backend:

- Node.js
- Express
- Supabase Admin SDK

Database:

- PostgreSQL (via Supabase)

Storage:

- Supabase Storage

Deployment:

- Render (Backend)
- Vercel (Frontend)

---

# Project Status

SmartIntern is deployed in a production-style environment with separated services and environment-based configuration.

Future improvements may include:

- Multi-tenant support
- Email notifications
- Audit logging
- Advanced analytics dashboard
- Payment and subscription model

---

SmartIntern is designed as a structured, scalable internship management system built with clean separation of concerns and production-ready architecture.

CI test
