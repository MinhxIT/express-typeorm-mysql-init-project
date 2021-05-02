import { Exclude } from 'class-transformer';
import { Entity, Column, PrimaryColumn, OneToOne, JoinColumn } from 'typeorm';
import User from './User';

@Entity('t_user_info')
export default class UserInfo {

    @PrimaryColumn()
    @Exclude()
    public id: number;

    @Column()
    public name: string;

    @Column()
    public address: string;

    @Column({ name: 'expert_id' })
    public expertId: string;

    @Column({ name: 'phone_number' })
    public phoneNumber: string;

    @Column({ name: 'avatar_url' })
    public avatarUrl: string;

    @Column({ name: 'city' })
    public city: string;

    @Column({ name: 'is_deleted' })
    public isDeleted: boolean;

    @OneToOne(() => User, (user: User) => user.userInfo)
    @JoinColumn({
        name: 'id',
        referencedColumnName: 'id'
    })
    public user: User;
}