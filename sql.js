// Generating query strings
function s_quote(str){
  return "'" + str + "'";
}

// Fetch
function get_users(id){
  return `SELECT * FROM DATA.USERS WHERE id=${s_quote(id)}`;
}

function get_posts(user_id){
  return `SELECT * FROM DATA.POSTS WHERE user_id=${s_quote(user_id)}`;
}

// Add
function register(id, name, password, email){
  return `INSERT INTO DATA.USERS (id, name, password, email) VALUES (${s_quote(id)}, ${s_quote(name)}, ${s_quote(password)}, ${s_quote(email)})`;
}

function add_post(user_id, mood, text){
  return `INSERT INTO DATA.POSTS (user_id, mood, text) VALUES (${s_quote(user_id)}, ${s_quote(mood)}, ${s_quote(text)})`;
}

// Edit
// 暂且不写

// Del
function del_post(post_id){
  return `DELETE FROM DATA.POSTS WHERE post_id=${s_quote(post_id)}`;
}

module.exports = {
  get_users,
  get_posts,
  register,
  add_post,
  del_post
};
