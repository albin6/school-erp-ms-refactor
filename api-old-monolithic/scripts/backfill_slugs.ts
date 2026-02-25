import { sequelize } from '../src/infrastructure/database/sequelize';
import { Branch } from '../src/infrastructure/database/models/Branch';
const backfillSlugs = async () => {
    try {
        await sequelize.authenticate();
        console.log("Connected to database.");
        const branches = await Branch.findAll({
            where: {
                slug: null
            }
        });
        console.log(`Found ${branches.length} branches to update.`);
        for (const branch of branches) {
            let slug = branch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            let counter = 0;
            let finalSlug = slug;
            while (await Branch.count({ where: { slug: finalSlug, tenant_id: branch.tenant_id } }) > 0) {
                counter++;
                finalSlug = `${slug}-${counter}`;
            }
            branch.slug = finalSlug;
            await branch.save();
            console.log(`Updated branch ${branch.name} -> ${finalSlug}`);
        }
        console.log("Backfill complete.");
        process.exit(0);
    } catch (error) {
        console.error("Error backfilling slugs:", error);
        process.exit(1);
    }
};
backfillSlugs();
