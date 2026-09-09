import { prisma } from '../src/server/prisma';
import bcrypt from 'bcryptjs';

async function migratePins() {
  try {
    const users = await prisma.user.findMany();
    for (const user of users) {
      if (user.pin && !user.pin.startsWith('$2')) {
        const hashedPin = await bcrypt.hash(user.pin.trim(), 10);
        await prisma.user.update({
          where: { id: user.id },
          data: { pin: hashedPin },
        });
        console.log(`Updated PIN hash for user: ${user.username}`);
      }
    }
    console.log('PIN migration completed.');
  } catch (error) {
    console.error('PIN migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migratePins();
