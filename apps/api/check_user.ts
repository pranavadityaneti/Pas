import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const email = 'pranav.n@ideaye.in'
    console.log(`Checking user: ${email}`)

    const user = await prisma.user.findUnique({
        where: { email }
    })

    if (user) {
        console.log('User found in database:')
        console.log(JSON.stringify(user, null, 2))
    } else {
        console.log('User NOT found in database.')
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
