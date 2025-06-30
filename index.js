import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import 'dotenv/config';

const app = express();
const port = process.env.PORT;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use('/static', express.static('node_modules'));

const db = new pg.Client({
    connectionString: process.env.DATABASE_URL
});

const bookAPI = axios.create({
  baseURL: 'http://openlibrary.org'
});

db.connect();

let retrievedBooks = [];

const sortOrders = ['date_added DESC', 'date_added ASC', 'rating DESC', 'rating ASC'];

async function GetReadBooksFromDatabase(order)
{
  const sorting = sortOrders[order-1] || 'date_added ASC'; //order count from 1 and not 0

  console.log(`Order: ${sorting}`);

  try
  {
    const result = await db.query(`SELECT books_read.*, books_notes.notes, books_notes.short_description FROM books_read JOIN books_notes ON books_read.notes_id = books_notes.id ORDER BY ${sorting}`);
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

app.get("/", async (req, res)=>
{
  var order = req.query?.sort ?? 1;

  try
  {
    await GetReadBooksFromDatabase(order);
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

  // console.log(req.body.book);
  const bookISBN = JSON.parse(req.body.book).isbn[0];

  try
  {
    const bookNote = await db.query("INSERT INTO books_notes (notes, short_description) Values ($1, $2) RETURNING id",
      [feedback, shortInfo]
    );

    const noteID = bookNote.rows[0].id;

    const bookRead = await db.query("INSERT INTO books_read (notes_id, isbn, date_added, rating) VALUES ($1, $2, $3, $4)",
      [noteID, bookISBN, new Date(), rating]
    );
  }
  catch (error)
  {
    console.error("Could not insert new note", error.stack());
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

app.get("/update/:id", async (req, res)=>{
  const theID = req.params.id;

  console.log(`The Book ID is: ${theID}`);

  const foundDBBook = retrievedBooks.find(x => x.id == theID);

  console.log(`The Book name is: ${foundDBBook.isbn}`);

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

app.listen(port, ()=>{
    console.log(`Runnig server to port: ${port}`);
});