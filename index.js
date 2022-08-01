const express = require('express')
const pg = require('pg')
const {Client} = require('pg')
const cors = require('cors');
const dotenv = require('dotenv') 
const rateLimiter = require('./rate-limiter')
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require("helmet");




dotenv.config()

const client = new Client({
  user:process.env.PGUSER,
  password:process.env.PGPASSWORD,
  host:process.env.PGHOST,
  port:process.env.PGPORT,
  database:process.env.PGDATABASE,
})
client.connect()
.then(() => console.log("Connected successfuly"))
.catch(e=> console.log(e))
.finally(() =>  client.end())

// configs come from standard PostgreSQL env vars
// https://www.postgresql.org/docs/9.6/static/libpq-envars.html
const pool = new pg.Pool()

const queryHandler = (req, res, next) => {
  pool.query(req.sqlQuery).then((r) => {
    return res.json(r.rows || [])
  }).catch(next)
}

// Declaration of server
const app = express()

// Middleware 
app.options("*", cors({ origin: '*' }));
app.use(cors({ origin: '*'}));
app.use('/', express.static('build'));
app.use(bodyParser.json());
app.use(compression())
app.use(helmet());


app.get('/', rateLimiter({secondsWindow:10, allowedHits:20}), (req, res) => {
  
  res.send('Welcome to EQ Works 😎')
})

app.get('/events/hourly', (req, res, next) => {
  req.sqlQuery = `
    SELECT date, hour, events
    FROM public.hourly_events
    ORDER BY date, hour
    LIMIT 168;
  `
  return next()
}, queryHandler)

app.get('/events/daily', rateLimiter({secondsWindow:10, allowedHits:20}),(req, res, next) => {
  req.sqlQuery = `
    SELECT date, SUM(events) AS events
    FROM public.hourly_events
    GROUP BY date
    ORDER BY date
    LIMIT 7;
  `
  return next()
}, queryHandler)

app.get('/stats/hourly',rateLimiter({secondsWindow:10, allowedHits:20}), (req, res, next) => {
  req.sqlQuery = `
    SELECT date, hour, impressions, clicks, revenue
    FROM public.hourly_stats
    ORDER BY date, hour
    LIMIT 168;
  `
  return next()
}, queryHandler)

app.get('/stats/daily', rateLimiter({secondsWindow:10, allowedHits:20}), (req, res, next) => {
  req.sqlQuery = `
    SELECT date,
        SUM(impressions) AS impressions,
        SUM(clicks) AS clicks,
        SUM(revenue) AS revenue
    FROM public.hourly_stats
    GROUP BY date
    ORDER BY date
    LIMIT 7;
  `
  return next()
}, queryHandler)

app.get('/poi',rateLimiter({secondsWindow:10, allowedHits:20}), (req, res, next) => {
  
  if(Object.keys(req.query).length === 0 ){
  req.sqlQuery = `
    SELECT *
    FROM public.poi;
  `
  }else{
    req.sqlQuery = `
    SELECT poi_id,name,lat,lon
    FROM public.poi
    WHERE name ILIKE \'%${req.query.search}%\';
  `
  }
  
  
  
  return next()
}, queryHandler)

app.listen(process.env.PORT || 5555, (err) => {
  if (err) {
    console.error(err)
    process.exit(1)
  } else {
    console.log(`Running on ${process.env.PORT || 5555}`)
  }
})

// last resorts
process.on('uncaughtException', (err) => {
  console.log(`Caught exception: ${err}`)
  process.exit(1)
})
process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason)
  process.exit(1)
})
