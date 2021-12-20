const mysql = require('mysql');
const express = require('express');
const session = require('express-session');
const cors = require('cors');

const fs = require('fs');
const https = require('https');

var key = fs.readFileSync(__dirname + '/certs/selfsigned.key');
var cert = fs.readFileSync(__dirname + '/certs/selfsigned.crt');
var options = {
	  key: key,
	  cert: cert
};

const db_config = require('./config.js').db_config;
const session_secret = require('./config.js').session_secret;
const sql = require('./sql.js');
const app = express();
app.use(cors({
  origin: ['http://localhost:19006', 'http://localhost'],
	exposedHeaders: ['Content-Type','Set-Cookie'],
	allowedHeaders: ['Content-Type','Set-Cookie'],
  credentials: true,
}));

//
app.set('trust proxy', 1);

function log_req_info(){

}

// Generate response data
function res_data(ok, result, msg){
  data = { ok: ok, result: result, msg: msg == undefined ? '':msg };
  console.log("Sending back result:\n   " + JSON.stringify(data));
  return data;
}

// DB Connection
var db_con = mysql.createConnection(db_config);
db_con.connect(function (err) {
  if (err) {
    console.log("DB connection ❌ ->\n   " + err);
  } else {
    console.log("DB connection ✅");
  }
});

// Middleware
app.use(express.json());
//??什么意思 研究！
// app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: session_secret,
  resave: false,
  saveUninitialized: false,
  // store!
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 365,
    secure: true,
    httpOnly: false,
    sameSite: 'none'
  }
}));
app.use((req, res, next) => {
  console.log("@@@@@req.body -> " + JSON.stringify(req.body));
  console.log("@@@@@req.sessionID -> " + JSON.stringify(req.sessionID));
  next();
});

app.get('/isNew', function(req, res) {
  `
  GET
  Request Params: id
  `
  console.log("-- /isNew GET request");
  const id = req.query.id;

  //Filter
  if (!id) {
    res.json(res_data(0, '', 'invalid param'));
    return;
  }

  //Get ready!
  db_con.query(sql.get_users(id), function(err, result){
    if (err) {
      console.log("DB query(get users) ❌ ->\n   " + err);
      res.json(res_data(0, '', 'internal query error'));
      return;
    }
    console.log("DB query(get users) ✅");
    if (result.length == 0){
      res.json(res_data(1, 'yes'));
    } else {
      res.json(res_data(1, 'no'));
    }
    return;
  });
});

app.post('/register', function (req, res) {
  `
  POST
  Request Params: id, name, password, email
  `
  console.log("-- /resgister POST request");
  const id = req.body.id;
  const name = req.body.name;
  const password = req.body.password;
  const email = req.body.email;

  //Filter...
  if (!id || !password) {
    res.json(res_data(0, '', 'invalid param'));
    return;
  }
  //Basically first repeats isIDAvailable
  db_con.query(sql.get_users(id), function(err, result){
    if (err) {
      console.log("DB query(get users) ❌ ->\n   " + err);
      res.json(res_data(0, '', 'internal query error'));
      return;
    }
    console.log("DB query(get users) ✅");
    if (result.length != 0){
      res.json(res_data(0, '', 'occupied id'));
      return;
    }

    //Ok, get ready now
    db_con.query(sql.register(id, name, password, email), function (err, result){
      if (err) {
        console.log("DB query(register) ❌ ->\n   " + err);
        res.json(res_data(0, '', 'internal query error'));
        return;
      }
      console.log("DB query(register) ✅");
      res.json(res_data(1, ''));
      return;
    });
  });
});

app.post('/login', function (req, res) {
  `
  POST
  Request Params: id, password, email
  `
  console.log("-- /login POST request");
  const id = req.body.id;
  const password = req.body.password;

  //Filter
  if (!id || !password) {
    res.json(res_data(0, '', 'invalid param'));
    return;
  }

  //Ready...
  //Can also use the approach that looks for the user with certain id and password in db
  db_con.query(sql.get_users(id), function(err, result){
    if (err) {
      console.log("DB query(get users) ❌ ->\n   " + err);
      res.json(res_data(0, '', 'internal query error'));
      return;
    }
    console.log("DB query(get users) ✅");
    if (result.length > 0){
      if (result.length > 1){
        console.log("⚠️Warning! Duplicate user id found!");
      }
      user_data = result[0]; //use the first element
      // encryption?
      if (password == user_data.PASSWORD){
        //grant session
        req.session.user_id = id;
        // req.session.save(function (err){
        //   if (err){
        //     console.log("Save login session ❌ ->\n   " + err);
        //     res.json(res_data(0, '', 'session error'));
        //   } else {
        //     console.log("Save login session ✅");
        //     console.log(`### Logged In as ${id} ###`);
        //     res.json(res_data(1, ''));
        //   }
        // });
        res.json(res_data(1, ''));
      } else {
        //should distinguish 'incorrect password' with 'incorrect username'? security concerns...
        res.json(res_data(0, '', 'incorrect password'));
      }
      return;
    } else {
      res.json(res_data(0, '', 'user id not found'));
      return;
    }

  });
});

app.get('/logout', function (req, res){
  `
  GET
  `
  console.log("-- /logout GET request");

  req.session.destroy(function (err){
    if (err){
      res.json(res_data(0, '', 'unable to destroy session'));
      return;
    }
    res.clearCookie('con_sid').json(res_data(1, '', ''));
  });
})

app.get('/isLoggedIn', function(req, res){
  `
  GET
  `
  console.log("-- /isLoggedIn GET request");

  if (req.session.user_id){ //the cookie has to be existed
    res.json(res_data(1, 'yes'))
  } else {
    res.json(res_data(1, 'no'));
  }
});


// /get_users is for Admin...
// 也没写login check 忘了

// app.get('/get_users', function(req, res){
//   `
//   GET
//   Request Params: id
//   `
//   console.log("-- /get_users GET request");
//   const id =  req.query.id;
//
//   // Filter
//   if (!id){
//     res.json(res_data(0, '', 'invalid param'));
//     return;
//   }
//
//   db_con.query(sql.get_users(id), function(err, result){
//     if (err) {
//       console.log("DB query(get users) ❌ ->\n   " + err);
//       res.json(res_data(0, '', 'internal query error'));
//       return;
//     }
//     console.log("DB query(get users) ✅");
//     if (result.length > 0){
//       if (result.length > 1){
//         console.log("⚠️Warning! Duplicate user id found!");
//       }
//       // user_data = result[0]; //use the first element
//       res.json(res_data(1, result));
//     } else {
//       res.json(res_data(0, '', 'user id not found'));
//     }
//   });
// });

// OLD!!!!!
//
// app.get('/get_user', async function (req, res) {
//   `
//   GET
//   id: string
//   `
//   db_con = await oracledb.getConnection(db_config);
//   console.log("Successfully connected to database!");
//
//   const user_id = req.query.user_id;
//   const sql_cmd = get_user_query_str(user_id);
//   console.log("SQL CMD: " + sql_cmd);
//   const result = await db_con.execute(sql_cmd);
//   console.log("User(s) retrieved: \n" + result);
//
//   await db_con.close();
//   res.send(result.rows);
// })


app.get('/get_posts', function (req, res) {
  `
  GET
  Request params: id
  By default, get posts from the user that is currently logged in
  `
  console.log("-- /get_posts GET request");
  const user_id = req.session.user_id;
  if (!user_id){
    res.json(res_data(0, '', 'need to login'));
    return;
  }

  db_con.query(sql.get_posts(user_id), function (err, result){
    if (err) {
      console.log("DB query(get posts by user id) ❌ ->\n   " + err);
      res.json(res_data(0, '', 'internal query error'));
      return;
    }
    console.log("DB query(get posts by user id) ✅");
    res.json(res_data(1, result));
  });
});

// app.get('/get_posts_by_post_id', function (req, res){
//   `
//   GET
//   Request params: id
//   `
//   console.log("-- /get_posts_by_post_id GET request");
//   if (!req.session.user_id){
//     res.json(res_data(0, '', 'need to login'));
//     return;
//   }
//
//   const id = req.query.id;
//   if (!id){
//     res.json(res_data(0, '', 'invalid param'));
//     return;
//   }
//
//   db_con.query(sql.get_posts_by_post_id(id), function (err, result){
//     if (err) {
//       console.log("DB query(get posts by user id) ❌ ->\n   " + err);
//       res.json(res_data(0, '', 'internal query error'));
//       return;
//     }
//     console.log("DB query(get posts by user id) ✅");
//     res.json(res_data(1, result));
//   });
// });

app.post('/add_post', function (req, res){
  `
  POST
  Request Params: mood, context
  `
  console.log("-- /add_post POST request");
  const user_id = req.session.user_id;
  if (!user_id){
    res.json(res_data(0, '', 'need to login'));
    return;
  }

  const mood = (!req.body.mood) ? "":req.body.mood;
  const text = req.body.text;
  if (!text){
    res.json(res_data(0, '', 'invalid param'));
    return;
  }

  db_con.query(sql.add_post(user_id, mood, text), function(err, result){
    if (err) {
      console.log("DB query(add post) ❌ ->\n   " + err);
      res.json(res_data(0, '', 'internal query error'));
      return;
    }
    console.log("DB query(add post) ✅");
    res.json(res_data(1, ''));
    return;
  });
});

app.post('/del_post', function (req, res) {
  `
  POSTS
  Request Params: post_id
  `
  console.log("-- /del_post POST request");
  const user_id = req.session.user_id;
  if (!user_id){
    res.json(res_data(0, '', 'need to login'));
    return;
  }

  const post_id = req.body.post_id;
  if (!post_id){
    res.json(res_data(0, '', 'invalid param'));
    return;
  }

  db_con.query(sql.del_post(post_id), function (err, result){
    if (err) {
      console.log("DB query(delete post) ❌ ->\n   " + err);
      res.json(res_data(0, '', 'internal query error'));
      return;
    }
    console.log("DB query(delete post) ✅");
    res.json(res_data(1, ''));
  });

});

app.get('/sessionUserID', function(req, res){
  console.log("req.session.user_id -> " + req.session.user_id);
  res.json(req.session.user_id);
  return;
});

app.get('/mycookies', function (req, res) {
	console.log(JSON.stringify(req.headers));
	res.send('okok');
});

// ```
// APIs:
// Add post
// Del post
// Add user
// Del user (注销账号
// Find post
// Find user
// ```



var server = https.createServer(options, app);

const port = 8081;
server.listen(port, () => {
	  console.log("server starting on port : " + port)
});
