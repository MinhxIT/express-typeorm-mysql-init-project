import * as bcrypt from 'bcrypt';
import { Exclude, Expose } from 'class-transformer';
import generator from 'generate-password';
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, BeforeInsert, ManyToMany, JoinTable, AfterLoad, BeforeUpdate } from 'typeorm';
import { PERMISSIONS } from '../../constant';
import UserInfo from './UserInfo';
import UserPermission from './UserPermission';

@Entity('t_user')
export default class User {

    @PrimaryGeneratedColumn()
    public id: number;

    @Column()
    public username: string;

    @Column()
    public enable: boolean;

    @Column()
    @Exclude()
    public password: string;

    @Column()
    @Expose({ groups: ['register'] })
    public token: string;

    @Column({ name: 'created_by' })
    @Exclude()
    public createdBy: number;

    @Column({ name: 'created_at' })
    public createdAt: Date;

    @OneToOne(() => UserInfo, (userInfo: UserInfo) => userInfo.user)
    @JoinColumn({
        name: 'id',
        referencedColumnName: 'id'
    })
    public userInfo?: UserInfo;

    public permissions: number[];

    @ManyToMany(() => UserPermission)
    @Exclude()
    @JoinTable({
        name: 't_user_permission',
        joinColumn: {
            name: "user_id",
            referencedColumnName: "id"
        },
        inverseJoinColumn: {
            name: "permission_id",
            referencedColumnName: "id"
        }
    })
    userPermissions: UserPermission[];

    @AfterLoad()
    afterLoad() {
        this.permissions = this.userPermissions ? this.userPermissions.map((item) => item.id) : [];
    }

    hasPermission(permission: PERMISSIONS): boolean {
        return this.permissions.indexOf(permission) >= 0;
    }

    @BeforeInsert()
    @BeforeUpdate()
    setDefaultValues() {
        if (this.password) {
            this.password = bcrypt.hashSync(this.password, 10);
        }

        this.token = generator.generate({
            length: 20
        });
    }
}