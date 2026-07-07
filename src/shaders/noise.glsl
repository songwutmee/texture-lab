uniform vec2  u_res;
uniform float u_scale,u_oct,u_lac,u_per,u_seed,u_ws,u_wf;
uniform float u_cont,u_bri,u_lo,u_hi,u_inv,u_seamless,u_tx,u_ty,u_panx,u_pany;
uniform int   u_type,u_out;

float getNoise(vec2 uv){
  vec2 p=uv*u_scale+vec2(u_seed*0.01);
  float ws=u_ws;
  if(ws>0.){
    vec2 w=vec2(fbm(p+vec2(0.,u_seed*0.01),int(u_oct),u_lac,u_per),
                fbm(p+vec2(5.2,1.3),       int(u_oct),u_lac,u_per));
    p+=ws*w*u_wf;
  }
  if(u_type==0) return fbm(p,int(u_oct),u_lac,u_per)*.5+.5;
  if(u_type==1) return voronoi(p);
  if(u_type==2) return worley(p);
  if(u_type==3) return ridge(p,int(u_oct),u_lac,u_per);
  if(u_type==4) return fbm(p,int(u_oct),u_lac,u_per)*.5+.5;
  if(u_type==5) return curl(p);
  if(u_type==6) return erosion(p,int(u_oct),u_lac,u_per);
  if(u_type==7) return spots(p);
  if(u_type==8) return value(p);
  if(u_type==9) return hash21(p);
  return 0.;
}

void main(){
  vec2 uv=gl_FragCoord.xy/u_res;
  uv+=vec2(u_panx,u_pany);
  uv=fract(uv*vec2(u_tx,u_ty));

  float v;
  if(u_seamless>0.5){
    float v0=getNoise(uv), v1=getNoise(uv+vec2(1.,0.));
    float v2=getNoise(uv+vec2(0.,1.)), v3=getNoise(uv+vec2(1.,1.));
    vec2 b=smoothstep(0.,1.,fract(uv));
    v=mix(mix(v0,v1,b.x),mix(v2,v3,b.x),b.y);
  } else v=getNoise(uv);

  v=(v-u_lo)/max(u_hi-u_lo,0.001);
  v=pow(clamp(v,0.,1.),1./max(u_cont,0.01))*u_cont;
  v=clamp(v+u_bri,0.,1.);
  if(u_inv>0.5) v=1.-v;
  v=clamp(v,0.,1.);

  vec4 c;
  if(u_out==0)      c=vec4(v,v,v,1.);
  else if(u_out==1) c=vec4(v,0.,0.,1.);
  else if(u_out==2) c=vec4(0.,v,0.,1.);
  else if(u_out==3) c=vec4(0.,0.,v,1.);
  else              c=vec4(v,v,v,v);
  gl_FragColor=c;
}
