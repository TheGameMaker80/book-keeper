# 📚 Book Keeper

A Node.js web application to keep track of the books you've read and your personal notes.

---

## 🚀 Features

* Search books via OpenLibrary
* Add/Update/Delete notes and ratings
* Sort books by date or rating
* Search books by title or author

---

## 💠 Installation

### 1. Clone the repository

```bash
git clone https://github.com/TheGameMaker80/book-keeper.git
cd book-keeper
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up the database

Make sure PostgreSQL is installed and running.

#### Create a database:

```bash
createdb books
```

#### Run the schema script:

Use pgAdmin or run in terminal:

```bash
psql -U postgres -d books -f schema.sql
```

#### Or copy and run the SQL below:

```sql
-- Drop tables if they exist
DROP TABLE IF EXISTS public.books_read CASCADE;
DROP TABLE IF EXISTS public.books_notes CASCADE;

-- Create books_notes table
CREATE TABLE IF NOT EXISTS public.books_notes (
    id SERIAL PRIMARY KEY,
    notes TEXT,
    short_description TEXT
);

-- Create books_read table
CREATE TABLE IF NOT EXISTS public.books_read (
    id SERIAL PRIMARY KEY,
    notes_id INTEGER REFERENCES public.books_notes(id) ON DELETE CASCADE,
    isbn VARCHAR(80) NOT NULL UNIQUE,
    date_added DATE,
    rating INTEGER
);
```

---

### 4. Create `.env` file

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/books
```

> Replace `yourpassword` with your actual PostgreSQL password.

---

## ▶️ Running the app

```bash
node index.js
```

Visit `http://localhost:3000`

---

## 🙌 Contributions

PRs and suggestions are welcome! Feel free to fork and contribute.

---

## 📄 License

MIT
