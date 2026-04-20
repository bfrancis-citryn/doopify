Overview

Doopify is a custom-built headless eCommerce platform designed to replicate and extend core functionality of Shopify.

The system consists of:
	•	A Next.js frontend storefront
	•	A Node.js backend API
	•	A Prisma ORM database layer
	•	An admin CMS/dashboard

The architecture is headless, meaning the frontend consumes data from the backend via API.

⸻

Core Objectives

The AI agent should prioritize:
	1.	Building a scalable, modular architecture
	2.	Maintaining clean separation between frontend and backend
	3.	Using Prisma as the single source of truth for data models
	4.	Writing production-ready code (not prototypes)
	5.	Avoiding unnecessary abstractions or overengineering

⸻

Tech Stack
	•	Frontend: Next.js (App Router preferred)
	•	Backend: Next.js API routes or separate Node service
	•	ORM: Prisma
	•	Database: PostgreSQL
	•	Auth: JWT or session-based (prefer simplicity first)
	•	Payments: Stripe (to be integrated later)

⸻

System Architecture

1. Frontend (Storefront)

Responsibilities:
	•	Display products and collections
	•	Handle cart state (client-side or hybrid)
	•	Initiate checkout
	•	Render CMS-driven pages

Rules:
	•	Never directly access the database
	•	Always fetch via API layer
	•	Keep UI components reusable and modular

⸻

2. Backend API

Responsibilities:
	•	Business logic
	•	Data validation
	•	Authentication
	•	Order processing

Structure:
	•	/api/products
	•	/api/orders
	•	/api/customers
	•	/api/cms

Rules:
	•	All database access must go through Prisma
	•	Validate all incoming data
	•	Keep controllers thin, logic in services

⸻

3. Database (Prisma)

Prisma is the core data layer.

Key models to implement:
	•	User
	•	Product
	•	ProductVariant
	•	Order
	•	OrderItem
	•	Customer
	•	Category
	•	CMSPage / ContentBlock

Rules:
	•	Use proper relational mapping
	•	Avoid duplication of data
	•	Normalize where possible, denormalize only for performance

⸻

Development Priorities (Build Order)

Phase 1 – Foundation
	•	Setup Prisma schema
	•	Run migrations
	•	Seed basic data
	•	Create API routes for:
	•	Products (CRUD)
	•	Customers (basic)
	•	Connect frontend to product API

⸻

Phase 2 – Core Commerce
	•	Product variants
	•	Cart logic (frontend or API)
	•	Order creation endpoint
	•	Order persistence in database

⸻

Phase 3 – Admin CMS
	•	Admin authentication
	•	Product management UI
	•	Order dashboard
	•	CMS page editor

⸻

Phase 4 – Checkout & Payments
	•	Integrate Stripe
	•	Secure checkout flow
	•	Order status updates

⸻

Coding Standards

General
	•	Use TypeScript everywhere
	•	Avoid any
	•	Use clear naming conventions
	•	Keep files under 300 lines when possible

API Design
	•	RESTful structure
	•	Consistent response format:

{
  success: boolean,
  data: any,
  error?: string
}

Error Handling
	•	Never expose raw errors to client
	•	Use structured error responses

⸻

Folder Structure (Recommended)

/app
/storefront
/admin

/lib
/prisma
/auth
/utils

/server
/controllers
/services
/middlewares

/prisma
schema.prisma

⸻

AI Agent Instructions

When assisting:
	•	Do NOT generate placeholder logic unless explicitly asked
	•	Always connect code to existing architecture
	•	Ask for missing schema details before guessing
	•	Prefer extending existing files over creating duplicates
	•	Keep solutions simple and composable

When writing Prisma:
	•	Always include relations
	•	Include indexes where needed
	•	Think about query performance

When working on frontend:
	•	Fetch data via API routes only
	•	Use server components when possible
	•	Avoid unnecessary client-side state

⸻

What NOT to Do
	•	Do not introduce new frameworks
	•	Do not restructure the entire project without reason
	•	Do not mix business logic into UI components
	•	Do not bypass Prisma

⸻

Future Considerations
	•	Multi-tenant architecture
	•	Plugin/app system
	•	Subscription billing
	•	Advanced analytics

⸻

Definition of Done

A feature is complete when:
	•	It works end-to-end (DB → API → UI)
	•	It handles errors properly
	•	It is reusable and maintainable
	•	It follows the defined architecture

⸻

Notes

This is not a prototype. Build everything as if it will scale into a SaaS product.