# 📚 Book Keeper

A Node.js web application to keep track of the books you've read and your personal notes.

---

## 🚀 Features

* Search books via OpenLibrary
* Add/Update/Delete notes and ratings
* Sort books by date or rating
* Search books by title or author
* Sign up/Sign in suport.(Local, Google)

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
DROP TABLE IF EXISTS public.users CASCADE;

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL
)

-- Create books_notes table
CREATE TABLE IF NOT EXISTS public.books_notes (
    id SERIAL PRIMARY KEY,
    notes TEXT,
    short_description TEXT,
    user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE
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
PORT=3000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/books
SESSION_SECRET=yoursessionsecret
GOOGLE_CLIENT_ID=yourgoogleclientid
GOOGLE_CLIENT_SECRET=yourgoogleclientsecret
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/book-keeper"

```

> Replace `yourpassword` with your actual PostgreSQL password.
> Replace `yoursessionsecret` with your actual Session secret.
> Replace `yourgoogleclientid` with your actual Google client ID.
> Replace `yourgoogleclientsecret` with your actual Google client secret.

---

### 5. Setting up Google OAuth 2.0 for Authentication

#### Go to Google Cloud Console

Visit: https://console.cloud.google.com/
Log in with your Google account.

#### Create a Project (or select an existing one)

Click "Select a project" → "New Project"
Give your project a name (e.g., Book Keeper)
Click "Create"

#### Access "Credentials" under APIs & Services

-Click on the hamburger menu and navigate to "APIs & Services" → "Credentials".
-Click on the "Configure consent screen".
-Set your "App name(e.g., book-keeper)", 
          "User support email(your email)", 
          "Audience(set to External)", 
          "Contact Information(your email)", 
          Agree to Google API services user data policy,
          and click "Create".

-Click on "Data access" → "Add or remove scopes" and check the ".../auth/userinfo.email" and press Update.
-Once your done, navigate back to "Credentials", click "Create Credentials - OAuth client ID".
-Select "Web Application".
-Add "http://localhost:3000" to your Javascript origins.
-Add "http://localhost:3000/auth/google/book-keeper" to your redirect URI.
-Click "Create".
-Add Client ID and Client secret in your .env file.(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).

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
