const cron = require('node-cron');

async function cron1() {
    // Cron1 code - Simple cleanup task
    console.log(':::::::::: Daily Cleanup Cron ::::::::::');
}

async function cron2() {
    // Cron2 code.
    console.log(':::::::::: Cron2 run successfully ::::::::::');
}

function runCron() {
    console.log('Setting up cron jobs with Asia/Kolkata timezone');
    console.log('Current time:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    
    // Schedule daily cleanup at midnight (12:00 AM)
    cron.schedule('0 0 * * *', cron1, { 
        timezone: 'Asia/Kolkata',
        scheduled: true 
    });
    
    // Schedule daily cleanup at 2:00 AM
    cron.schedule('0 2 * * *', cron2, { 
        timezone: 'Asia/Kolkata',
        scheduled: true 
    });
    
    console.log('Cron jobs scheduled:');
    console.log('- Daily Cleanup: 0 0 * * * (Daily at midnight)');
    console.log('- Secondary Task: 0 2 * * * (Daily at 2 AM)');
}

/**
 * Cron services are exported from here 👇
 */
module.exports = runCron;
