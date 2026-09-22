const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');

const seedRoles = async () => {
  try {
    await connectDB();

    const usersToCreate = [
      {
        username: 'Aman',
        email: 'aman@speedsetu.com',
        password: 'Aman@1234',
        name: 'Aman Singh',
        role: 'Super Admin',
        branch: 'Headquarters',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'
      },
      {
        username: 'OperationsAdmin',
        email: 'admin@speedsetu.com',
        password: 'Admin@1234',
        name: 'Operations Manager',
        role: 'Admin',
        branch: 'Delhi Hub',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150'
      },
      {
        username: 'RajeshDriver',
        email: 'driver@speedsetu.com',
        password: 'Driver@1234',
        name: 'Rajesh Kumar (Driver)',
        role: 'Driver',
        branch: 'Fleet Ops',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150'
      }
    ];

    for (const userData of usersToCreate) {
      const existing = await User.findOne({
        $or: [{ username: userData.username }, { email: userData.email }]
      });

      if (existing) {
        existing.password = userData.password;
        existing.name = userData.name;
        existing.role = userData.role;
        existing.branch = userData.branch;
        existing.avatar = userData.avatar;
        await existing.save();
        console.log(`✅ User "${userData.name}" (${userData.role}) updated in MongoDB.`);
      } else {
        await User.create(userData);
        console.log(`✅ User "${userData.name}" (${userData.role}) created in MongoDB.`);
      }
    }

    console.log('🎉 All 3 role demo accounts seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding role accounts:', error);
    process.exit(1);
  }
};

seedRoles();
