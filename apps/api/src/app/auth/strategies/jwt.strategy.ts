import {Injectable} from "@nestjs/common";
import {PassportStrategy} from "@nestjs/passport";
import {ConfigService} from "@nestjs/config";
import {Strategy,ExtractJwt} from "passport-jwt";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:configService.get<string>('JWT_SECRET','fallback_secret')
    })
  }
  async validate(payload: {sub:string; email:string}) {
    return {id:payload.sub, email:payload.email}
  }
}
