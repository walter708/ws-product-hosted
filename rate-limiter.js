const Redis = require('ioredis')
const REDIS_PORT = process.env.REDISPORT || 6379
const redisClient  = new Redis(REDIS_PORT)

const rateLimiter =  ({secondsWindow, allowedHits }) =>{
  return async (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] ||  req.socket.remoteAddress 
    const request = await redisClient.incr(ip)
    let ttl
    if(request === 1){
      await redisClient.expire(ip, secondsWindow)
      ttl = secondsWindow
    } else {
        ttl = await redisClient.ttl(ip)
    }
    
    if(request > allowedHits){
      return res.status(503).json({
        response: 'error',
        calllsInAMinute:request, ttl
      })
    }else{
      next() 
    }
  }

}

module.exports = rateLimiter