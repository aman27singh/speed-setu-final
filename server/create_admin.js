const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');

const createAdminUser = async () => {
  try {
    await connectDB();

    const adminData = {
      username: 'Aman',
      email: 'aman@speedsetu.com',
      password: 'Aman@1234',
      name: 'Aman',
      role: 'Super Admin',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'
    };

    const existingUser = await User.findOne({
      $or: [{ username: 'Aman' }, { email: 'aman@speedsetu.com' }]
    });

    if (existingUser) {
      existingUser.password = 'Aman@1234';
      existingUser.name = 'Aman';
      existingUser.role = 'Super Admin';
      await existingUser.save();
      console.log('✅ Admin user "Aman" updated in MongoDB!');
    } else {
      await User.create(adminData);
      console.log('✅ Admin user "Aman" created successfully in MongoDB!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();
