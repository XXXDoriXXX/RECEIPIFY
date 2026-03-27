import {createParamDecorator, ExecutionContext} from "@nestjs/common";


export const CurrentUser = createParamDecorator(
  (data:'id'|'email'|undefined, ctx:ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    //optional: allow extracting specific data from user object, like @CurrentUser('email')
    return data ? user?.[data] : user;
  }
);
