# 📝 MarrowDo

A modern and powerful **To-Do app** built with full-stack technologies, offering seamless task management with a clean UI and rich features.

🔗 [Live Demo](https://marrowdo.vercel.app/)

---

## 🚀 Tech Stack

* **Frontend & Fullstack Framework:** [Next.js](https://nextjs.org/)
* **ORM:** [Prisma](https://www.prisma.io/)
* **Database:** PostgreSQL
* **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)

---

## 📦 Features

* Add, edit, delete todos
* Toggle completion status
* Categorize tasks
* Modern responsive UI
* Smooth developer experience with PNPM

---

## 🛠️ Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/mskp/todo-app
cd marrowdo
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Setup PostgreSQL locally

Make sure PostgreSQL is running on your machine and create a new database.

### 4. Configure `.env`

Update your `.env` file with your PostgreSQL connection URL:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"
```

### 5. Run Prisma migrations

```bash
npx prisma migrate dev
```

### 6. Start the development server

```bash
pnpm dev
```