const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const knex = require('knex');
const clarifai = require('clarifai');
const clarifaiApp = new clarifai.App({
  apiKey: 'a3da4f0399a845dda8742be3de10c44e'
});

const db = knex({
	client: 'pg',
	connection: {
		connectionString: process.env.DATABASE_URL,
		ssl: true
	}
});


const app = express();
app.use(express.json());
app.use(cors());

//não temos ainda um banco de dados, então vamos guardar as informações do usuário em memória volátil


app.get('/', (req, res) => {

	db.select('name').from('users')
	.then(users => res.json(users))
	.catch(err => res.status(400).json('Unable to GET users'));	
});

app.post('/signin', (req, res) => { 
	const {email, password} = req.body;
	if (!email || !password) return res.status(400).json('nope');	
	db.select('email', 'hash').from('login')
	.where('email', '=', email)
	.then(data => {
		const isValid =	bcrypt.compareSync(password, data[0].hash)
		if (isValid) {
			return db.select('*').from('users').where('email', '=', email)
			.then(user => res.json(user[0]))
			.catch(err => res.status(400).json('Error getting user'))
		} else {

			res.status(400).json('Wrong credentials');
		}
	})
	.catch( err => res.status(400).json('Something went wrong'))	

});

app.post('/register', (req, res) => {
		
	const {name, email, password } = req.body;
	if (!email || !name || !password ) {
		return res.status(400).json('incorrect form submission');
	} 
	const hash = bcrypt.hashSync(password, 10);
	db.transaction(trx => { //use transactions when you need to do two things at once
		trx.insert({
			hash: hash, 
			email: email
		})
		.into('login')
		.returning('email')
		.then(loginEmail => {
			return trx('users')
			.returning('*') // returns all the columns
			.insert({
				email: loginEmail[0],
				name: name,
				joined: new Date()
			})
			.then(user => {
				res.json(user[0]);
			})
		
		})
		.then(trx.commit)
		.catch(trx.rollback)
	})
	.catch(err => res.status(400).json('unable to join'))	

});


app.get('/profile/:userId', (req, res) => {

	const {userId} = req.params;

	let found = false;	
	let foundUser = {};
	
	db.select('*').from('users').where({
	
		id: userId,
		

	})
	.then(user => {

	if (user.length) {
		res.json(user[0]);
	} else {
		res.status(400).json('Not found');
	}

	})
	.catch( err => res.status(400).json('error getting user'))	

});


app.put('/image', (req, res) => {

	const {id} = req.body;
	db('users').where('id', '=', id)
	.increment('score', 1)
	.returning('score')
	.then(score => {
		if (score.length)
			res.json(score[0]);
		else
			res.status(400).json('user not found')
	})
	.catch(err => res.status(400).json('Error updating score'))
	
} );


app.post('/imageurl', (req, res) => {
     
     clarifaiApp.models
    .predict(
      clarifai.FACE_DETECT_MODEL,
      req.body.input)
    .then(data => { return res.json(data) } )
    .catch(err => res.status(400).json('error connecting to clarifai api'));

});



app.listen(process.env.PORT || 3000, () => {

	console.log(`Server listening on port $(process.env.PORT)`);
});
/*

/ -> res = it is working
/signin --> POST = success/fail
/register --> POST = user
/profile/:userId --> GET = user
/image --> PUT  = user 


*/
