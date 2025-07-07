import express, { response } from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import 'dotenv/config';
import session from "express-session";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";

const app = express();
const port = process.env.PORT;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use('/static', express.static('node_modules'));
app.use('/bootstrap', express.static('node_modules/bootstrap/dist'));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized:true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24
  }
}));

app.use(passport.initialize());
app.use(passport.session());

function checkIfAuthenticated(req, res, next)
{
  if(req.isAuthenticated())
  {
    next();
  }
  else
  {
    res.render("home.ejs", {
      hideSearch: true,
      hideLogout: true
    });
  }
}

const db = new pg.Client({
    connectionString: process.env.DATABASE_URL
});

const bookAPI = axios.create({
  baseURL: 'http://openlibrary.org'
});

db.connect();

const saltRounds = 10;

let retrievedBooks = [];

const sortOrders = ['date_added DESC', 'date_added ASC', 'rating DESC', 'rating ASC'];

async function GetReadBooksFromDatabase(userID, order)
{
  const sorting = sortOrders[order-1] || 'date_added ASC'; //order count from 1 and not 0
  
  try
  {
    const result = await db.query(`SELECT books_read.*, books_notes.notes, books_notes.short_description FROM books_read JOIN books_notes ON books_read.notes_id = books_notes.id WHERE user_id = $1 ORDER BY ${sorting}`,
      [userID]
    );
    retrievedBooks = result.rows;
  }
  catch(error)
  {
    throw(error);
  }
}

function formatDate(date)
{
  const month = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  var newDate = "";

  if(date)
  {
    newDate = `${month[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")} ${date.getFullYear()}`;
  }

  return newDate;
}

app.get("/", checkIfAuthenticated, (req, res)=>{
    res.redirect("/book-keeper");
});

app.get("/register", (req, res)=>{
  res.render("signup.ejs", {
    hideSearch: true,
    hideLogout: true
  });
});

app.get("/book-keeper", checkIfAuthenticated, async (req, res)=>
{
  var order = req.query?.sort ?? 1;

  try
  {
    await GetReadBooksFromDatabase(req.user.rows[0].id, order);
  }
  catch(error)
  {
    console.error("Get Read books from Database failed!", error.stack);
  }

  try
  {
    const savedBooks = await Promise.all(
      retrievedBooks.map(async (book) => {
        const result = await bookAPI.get(`/search.json?isbn=${book.isbn}`);

        const theBook = result.data.docs[0];
        theBook.shortInfo = book.short_description;
        theBook.description = book.notes;
        theBook.readDate = formatDate(book.date_added);
        theBook.rating = book.rating;
        theBook.id = book.id;

        return theBook;
      })
    );

    res.render("index.ejs", {
      books: savedBooks,
      sortOrder: order
    });
  }
  catch (error) {
    console.error("Failed to fetch book details", error.stack);
    res.status(500).send("Book API error");
  }
});

app.get("/search", async (req, res)=>
{
  const searchText = req.query?.searchTxt;

  if(searchText)
  {
    const result = await bookAPI.get(`/search.json?q=${searchText}&fields=isbn,title,cover_edition_key,author_key,author_name,first_publish_year`);
    const booksReturned = result.data.docs;

    var i = 0;

    booksReturned.forEach(book => {
      book.index_id = i;
      i++;
    });

    res.render("search-results.ejs", {
      booksReturned: booksReturned
    });
  }
  else
  {
    res.redirect('/');
  } 
});

app.get("/update/:id", async (req, res)=>{
  const theID = req.params.id;
  const foundDBBook = retrievedBooks.find(x => x.id == theID);

  try 
  {
    const result = await bookAPI.get(`/search.json?isbn=${foundDBBook.isbn}`);

    const theBook = result.data.docs[0];
    theBook.shortInfo = foundDBBook.short_description;
    theBook.description = foundDBBook.notes;
    theBook.readDate = formatDate(foundDBBook.date_added);
    theBook.rating = foundDBBook.rating;
    theBook.id = foundDBBook.id;

    res.render("new-record.ejs", {
      book: theBook,
      hideSearch: true
    });

  } 
  catch (error) 
  {
    console.error("Something went wrong in /update", error.stack); 
    res.redirect("/");
  }
});

app.get("/read-more/:id", async (req, res)=>{
  const theID = req.params.id;
  const foundDBBook = retrievedBooks.find(x => x.id == theID);

  try 
  {
    const result = await bookAPI.get(`/search.json?isbn=${foundDBBook.isbn}`);

    const theBook = result.data.docs[0];
    theBook.description = foundDBBook.notes;
    theBook.readDate = formatDate(foundDBBook.date_added);
    theBook.rating = foundDBBook.rating;
    theBook.id = foundDBBook.id;

    res.render("read-more.ejs", {
      book: theBook,
      hideSearch: true
    });

  } 
  catch (error) 
  {
    console.error("Something went wrong in /update", error.stack); 
    res.redirect("/");
  }
});

// app.post("/login", passport.authenticate('local',{
//   successRedirect: "/book-keeper",
//   failureRedirect: "/"
// }));

app.post("/login", (req, res, next)=>{
  passport.authenticate('local', (err, user, info)=>{
    if(err) return next(err);

    if(!user)
    {
      return res.render("home.ejs", {
        hideSearch: true,
        hideLogout: true,
        errorMessage: info.message
      });
    }

    req.login(user, (err)=>{
      if(err) return next(err);

      return res.redirect("/book-keeper");
    });
  })(req, res, next);
});

app.post("/login/google", passport.authenticate('google',{
  scope: ["profile", "email"]
}));

app.get("/auth/google/book-keeper", (req, res, next)=>{
  passport.authenticate('google',(err, user, info)=>{
    if(err) return next(err);

    if(!user)
    {
      return res.render("home.ejs", {
        hideSearch: true,
        hideLogout: true,
        errorMessage: info.message
      });
    }

    req.login(user, (err)=>{
      if(err) return next(err);

      return res.redirect("/book-keeper");
    });
  })(req, res, next);
});

app.get("/logout", (req, res, next)=>{
  req.logout((err)=>{
    if(err) return next(err);

    res.redirect("/");
  });
});

app.post("/signup", async (req, res)=>{
  const email = req.body.email;
  const password = req.body.password;

  try
  {
    const result = await db.query("SELECT * FROM users WHERE email = $1",
      [email]
    );

    if(result.rows.length > 0)
    {
      console.log("User already registered.Log in instead!");
      const message = `<h4 class="alert-heading">Sign up failed!</h4>
                       <p>User already registered.Log in instead!</p>`

      return res.render("home.ejs", {
        hideSearch: true,
        hideLogout: true,
        errorMessage: message
      });
    }
    else
    {
      bcrypt.hash(password, saltRounds, async function (err, hash) {
        if(err)
        {
          console.log(err);
        }
        else
        {
          const theUser = await db.query("INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );

          req.login(theUser, (err)=>{
            res.redirect("/book-keeper");
          });
        }
      });
    }
  }
  catch (error)
  {
    console.log(error);
  }
});

app.post("/new-record", (req, res) =>{
  const record = JSON.parse(req.body.record);

  res.render("new-record.ejs", {
    book: record
  });

});

app.post("/save-record", async (req, res)=>{
  const feedback = req.body.feedback;
  const shortInfo = req.body.shortInfo;
  const rating = req.body.rating;
  const userID = req.user.rows[0].id;

  // console.log(req.body.book);
  const bookISBN = JSON.parse(req.body.book).isbn[0];

  try
  {
    const bookNote = await db.query("INSERT INTO books_notes (notes, short_description, user_id) Values ($1, $2, $3) RETURNING id",
      [feedback, shortInfo, userID]
    );

    const noteID = bookNote.rows[0].id;

    const bookRead = await db.query("INSERT INTO books_read (notes_id, isbn, date_added, rating) VALUES ($1, $2, $3, $4)",
      [noteID, bookISBN, new Date(), rating]
    );
  }
  catch (error)
  {
    console.error("Could not insert new note", error.stack);
  }

  res.redirect("/");
});

app.post("/update-record", async (req, res)=>{
  const feedback = req.body.feedback;
  const shortInfo = req.body.shortInfo;
  const rating = req.body.rating;

  const bookID = req.body.bookID;

  try
  {
    const updateRead = await db.query("UPDATE books_read SET date_added = $1, rating = $2 WHERE id = $3",
      [new Date(), rating, bookID]
    );

    const updateNotes = await db.query("UPDATE books_notes SET notes = $1, short_description = $2 WHERE id= (SELECT notes_id FROM books_read WHERE id = $3)",
      [feedback, shortInfo, bookID]
    );
  }
  catch (error)
  {
    console.error("Could not insert new note", error.stack);
  }

  res.redirect("/");
});

app.delete("/delete/:id", async (req, res)=>{
  const theID = req.params.id;
  const foundDBBook = retrievedBooks.find(x => x.id == theID);

  try 
  {
    const result = await db.query('DELETE FROM books_notes WHERE id=$1',
      [foundDBBook.notes_id]
    );

    res.status(200).json({redirect: "/"});
  } 
  catch (error) 
  {
    console.error("Entry could not be deleted!", error.stack);
    res.status(500).json({error: "Failed to delete entry"});
  }
  
});

passport.use("google", 
  new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  }, 
  async(accessToken, refreshToken, profile, cb)=>{
    try
    {
      const foundUser = await db.query("SELECT * FROM users WHERE email = $1",
        [profile.email]
      );

      if(foundUser.rows.length > 0)
      {
        const password = foundUser.rows[0].password;

        if(password === "google")
        {
          cb(null, foundUser);
        }
        else
        {
          cb(null, false, 
            {
              message: `<h4 class="alert-heading">Login failed!</h4>
                        <p>The user (${profile.email}) already registered!</p>`
            });
        }
      }
      else
      {
        const result = await db.query("INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *", 
          [profile.email, "google"]
        );

        return cb(null, result);
      }
    }
    catch (error)
    {
      console.log(err);
      return cb(null, false);
    }
  }
))

passport.use("local", new Strategy(async function verify(username, password, cb){
  try
  {
    const foundUser = await db.query("SELECT * FROM users WHERE email = $1",
      [username]
    );

    if(foundUser.rows.length > 0)
    {
      const hashedPassword = foundUser.rows[0].password;

      bcrypt.compare(password, hashedPassword, function (err, result){
        if(err)
        {
          return cb(err);
        }

        if(result)
        {
          return cb(null, foundUser);
        }
        else
        {
          return cb(null, false, {
            message: `<h4 class="alert-heading">Login failed!</h4>
                      <p>The password added was incorect. Please try again</p>`
            });
        }
      })
    }
    else
    {
      return cb(null, false, {
            message: `<h4 class="alert-heading">Login failed!</h4>
                      <p>User is not registered. Please sign up!`
            });
    }
  }
  catch (error)
  {
    console.log(err);
    return cb(null, false);
  }
}));

passport.serializeUser(function(user, cb){
  cb(null, user);
});

passport.deserializeUser(function(user, cb){
  cb(null, user);
});

app.listen(port, ()=>{
    console.log(`Runnig server to port: ${port}`);
});