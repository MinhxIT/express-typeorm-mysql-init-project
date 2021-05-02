import { Exclude } from 'class-transformer';
import { Entity, Column, PrimaryColumn, ManyToMany, } from 'typeorm';
import User from './User';

@Entity('t_permission')
export default class UserPermission {

    @PrimaryColumn()
    @Exclude()
    public id: number;

    @Column({ name: 'permission_name' })
    public name: string;

    @ManyToMany(() => User, user => user.userPermissions)
    users: User[];

}