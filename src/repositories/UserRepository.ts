import * as bcrypt from 'bcrypt';
import { injectable } from 'inversify';
import { EntityRepository, Repository } from 'typeorm';
import User from '../models/db/User';

@injectable()
@EntityRepository(User)
export class UserRepository extends Repository<User> {
    findByUsername(username: string, includeInfo = false): Promise<User> {
        return this.findOne({
            ...includeInfo && { relations: ['userInfo', 'userPermissions'] },
            where: { username }
        });
    }

    async findByUsernamePassword(username: string, password: string): Promise<User> {
        const user = await this.findByUsername(username, true);

        if (user) {
            const isPasswordMatch = await bcrypt.compare(password, user.password);
            if (!isPasswordMatch) {
                return null;
            }
        }

        return user;
    }

    async findByUserIdAndToken(userId: number, token: string): Promise<User> {
        return this.findOne({
            relations: ['userInfo'],
            where: { id: userId, token }
        });
    }
}