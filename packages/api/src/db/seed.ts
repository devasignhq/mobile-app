import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseUrl } from './config';
import * as schema from './schema';
import { faker } from '@faker-js/faker';

const NUM_USERS = 15;
const NUM_BOUNTIES = 25;

async function seed() {
    console.log('⏳ Seeding database...');

    try {
        const queryClient = postgres(getDatabaseUrl());
        const db = drizzle(queryClient, { schema });

        // 1. Clear existing data (optional, but good for a fresh start)
        // Note: Order matters because of foreign key constraints
        console.log('  Cleaning up existing data...');
        await db.delete(schema.transactions);
        await db.delete(schema.messages);
        await db.delete(schema.extensionRequests);
        await db.delete(schema.disputes);
        await db.delete(schema.submissions);
        await db.delete(schema.applications);
        await db.delete(schema.bounties);
        await db.delete(schema.users);

        // 2. Generate Users
        console.log(`  Generating ${NUM_USERS} users...`);
        const userBatch = Array.from({ length: NUM_USERS }).map(() => ({
            githubId: BigInt(faker.number.int({ min: 1000000, max: 99999999 })),
            username: faker.internet.username(),
            avatarUrl: faker.image.avatarGitHub(),
            email: faker.internet.email(),
            techStack: faker.helpers.arrayElements(['TypeScript', 'React', 'Node.js', 'Rust', 'Go', 'Stellar', 'Solidity', 'Python'], { min: 2, max: 5 }),
            walletAddress: `G${faker.string.alphanumeric(55).toUpperCase()}`,
            totalEarned: String(Math.round(Math.random() * 5000 * 100) / 100),
            bountiesCompleted: faker.number.int({ min: 0, max: 20 }),
        }));
        const seededUsers = await db.insert(schema.users).values(userBatch).returning();

        // 3. Generate Bounties
        console.log(`  Generating ${NUM_BOUNTIES} bounties...`);

        const bountyBatch = Array.from({ length: NUM_BOUNTIES }).map(() => {
            const creator = faker.helpers.arrayElement(seededUsers);
            const status = faker.helpers.arrayElement(schema.statusEnum.enumValues);
            let assigneeId = null;
            if (status !== 'open' && status !== 'cancelled') {
                const potentialAssignees = seededUsers.filter(u => u.id !== creator.id);
                if (potentialAssignees.length > 0) {
                    assigneeId = faker.helpers.arrayElement(potentialAssignees).id;
                }
            }

            return {
                githubIssueId: faker.number.int({ min: 1, max: 10000 }),
                repoOwner: faker.helpers.arrayElement(['devasign', 'stellar', 'foundation', 'github']),
                repoName: faker.helpers.arrayElement(['monorepo', 'core-api', 'sdk-js', 'stellar-wallet']),
                title: faker.lorem.sentence({ min: 3, max: 8 }),
                description: faker.lorem.paragraphs(2),
                amountUsdc: String(Math.round((Math.random() * 2000 + 100) * 100) / 100),
                techTags: faker.helpers.arrayElements(['TypeScript', 'React', 'Rust', 'Go', 'Next.js'], { min: 1, max: 3 }),
                difficulty: faker.helpers.arrayElement(schema.difficultyEnum.enumValues),
                status: status,
                creatorId: creator.id,
                assigneeId: assigneeId,
                deadline: faker.date.future(),
            };
        });
        const seededBounties = await db.insert(schema.bounties).values(bountyBatch).returning();

        // 4. Generate Applications
        console.log('  Generating applications...');
        const applicationBatch: (typeof schema.applications.$inferInsert)[] = [];
        for (const bounty of seededBounties) {
            if (bounty.status === 'open' || bounty.status === 'assigned') {
                const numApps = faker.number.int({ min: 1, max: 5 });
                const potentialApplicants = seededUsers.filter(u => u.id !== bounty.creatorId);
                const applicants = faker.helpers.arrayElements(potentialApplicants, numApps);

                for (const applicant of applicants) {
                    const possibleStatuses = schema.applicationStatusEnum.enumValues.filter(s => s !== 'accepted');
                    const appStatus = bounty.assigneeId === applicant.id ? 'accepted' : faker.helpers.arrayElement(possibleStatuses);
                    applicationBatch.push({
                        bountyId: bounty.id as string,
                        applicantId: applicant.id as string,
                        coverLetter: faker.lorem.paragraph(),
                        estimatedTime: faker.number.int({ min: 2, max: 14 }),
                        experienceLinks: [faker.internet.url(), faker.internet.url()],
                        status: appStatus,
                    });
                }
            }
        }
        await db.insert(schema.applications).values(applicationBatch);

        // 5. Generate Submissions
        console.log('  Generating submissions...');
        const submissionBatch: (typeof schema.submissions.$inferInsert)[] = [];
        for (const bounty of seededBounties) {
            if ((bounty.status === 'in_review' || bounty.status === 'completed') && bounty.assigneeId) {
                const subStatus = bounty.status === 'completed' ? 'approved' : 'pending';
                submissionBatch.push({
                    bountyId: bounty.id as string,
                    developerId: bounty.assigneeId as string,
                    prUrl: `https://github.com/${bounty.repoOwner as string}/${bounty.repoName as string}/pull/${faker.number.int({ min: 1, max: 1000 })}`,
                    status: subStatus,
                    notes: faker.lorem.sentence(),
                });
            }
        }
        if (submissionBatch.length > 0) {
            await db.insert(schema.submissions).values(submissionBatch);
        }

        // 6. Generate Messages
        console.log('  Generating messages...');
        const messageBatch: (typeof schema.messages.$inferInsert)[] = [];
        for (const bounty of seededBounties) {
            const participants = [bounty.creatorId];
            if (bounty.assigneeId) participants.push(bounty.assigneeId);

            if (participants.length > 1) {
                const numMessages = faker.number.int({ min: 3, max: 10 });
                for (let i = 0; i < numMessages; i++) {
                    const senderId = faker.helpers.arrayElement(participants);
                    const recipientId = participants.find(p => p !== senderId);
                    if (recipientId) {
                        messageBatch.push({
                            bountyId: bounty.id as string,
                            senderId: senderId as string,
                            recipientId: recipientId as string,
                            content: faker.lorem.sentence(),
                        });
                    }
                }
            }
        }
        if (messageBatch.length > 0) {
            await db.insert(schema.messages).values(messageBatch);
        }

        // 7. Generate Transactions
        console.log('  Generating transactions...');
        const transactionBatch: (typeof schema.transactions.$inferInsert)[] = [];
        for (const bounty of seededBounties) {
            // Funding transaction for every bounty
            transactionBatch.push({
                userId: bounty.creatorId as string,
                type: 'bounty_funding' as const,
                amountUsdc: String(bounty.amountUsdc),
                bountyId: bounty.id as string,
                stellarTxHash: faker.string.hexadecimal({ length: 64, prefix: '' }),
                status: 'completed' as const,
            });

            // Payout for completed bounties
            if (bounty.status === 'completed' && bounty.assigneeId) {
                transactionBatch.push({
                    userId: bounty.assigneeId as string,
                    type: 'bounty_payout' as const,
                    amountUsdc: String(bounty.amountUsdc),
                    bountyId: bounty.id as string,
                    stellarTxHash: faker.string.hexadecimal({ length: 64, prefix: '' }),
                    status: 'completed' as const,
                });
            }
        }
        if (transactionBatch.length > 0) {
            await db.insert(schema.transactions).values(transactionBatch);
        }

        console.log('✅ Seeding completed');
        await queryClient.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed');
        console.error(error);
        process.exit(1);
    }
}

seed();
