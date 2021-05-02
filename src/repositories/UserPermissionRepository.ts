import { injectable } from 'inversify';
import { EntityRepository, Repository } from 'typeorm';
import UserPermission from '../models/db/UserPermission';

@injectable()
@EntityRepository(UserPermission)
export class UserPermissionRepository extends Repository<UserPermission> {

}