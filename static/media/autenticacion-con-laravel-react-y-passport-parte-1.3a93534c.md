En la mayoría de las aplicaciones que hacemos un requerimiento que está presente es
la autenticación, algunas veces el framework que utilizamos nos facilita esta tarea,
otras veces nos toca a nosotros mismos codificarlo. El objetivo de esta serie de
publicaciones es crear tanto el backend como el frontend de un sistema de autenticación.

Algunas secciones contienen información de artículos que he leído de [Claudio Vallejo](https://medium.com/@cvallejo) y que me han ayudado a crear esta serie.

### 1. Crear un nuevo proyecto de Laravel

Creamos un nuevo proyecto de laravel, en mi caso le pondré **auth-laravel-react-passport** como nombre.

```
composer create-project --prefer-dist laravel/laravel auth-laravel-react-passport
```

### 2. Configurar la base de datos

Dentro del proyecto encontraremos el archivo **.env**, en donde tendremos que actualizar las variables de entorno para establecer la conexión a nuestra base de datos.

```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=nombre_de_la_base_de_datos
DB_USERNAME=usuario
DB_PASSWORD=contraseña
```

### 3. Instalar Passport

Laravel hace que la autenticación API sea muy fácil con el paquete de autenticación Laravel Passport, el cual vamos a instalar y configurar como dice en la
[documentación](https://laravel.com/docs/5.8/passport).

#### 3.1 Instalar el paquete por medio del gestor de paquetes Composer

```
composer require laravel/passport
```

#### 3.2 Ejecutar las migraciones

Las migraciones de Passport crearán las tablas para almacenar los clientes y sus token de acceso.

```
php artisan migrate
```

#### 3.3 Instalar y generar las llaves

Este comando creará las claves de cifrado necesarias para generar los tokens de acceso seguro, clientes de **"personal access"** y **"password grant"** que se utilizarán para generar los tokens de acceso.

```
php artisan passport:install
```

#### 3.4 Agregar Passport al modelo de usuario

Agregamos el trait **Laravel\Passport\HasApiTokens** al **App\User**, el cual nos permitirá inspeccionar al token y scope de los usuarios autenticados.

```php
<?php

namespace App;

use Laravel\Passport\HasApiTokens;
use Illuminate\Notifications\Notifiable;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;
}
```

#### 3.5 Registrar rutas de Passport

Debemos colocar **Passport::routes** dentro del método **boot** en **AuthServiceProvider**, así tendremos las rutas para emitir tokens de acceso y revocar tokens de acceso, clientes, y tokens de acceso personal.

```php
<?php

namespace App\Providers;

use Laravel\Passport\Passport;
use Illuminate\Support\Facades\Gate;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The policy mappings for the application.
     *
     * @var array
     */
    protected $policies = [
        'App\Model' => 'App\Policies\ModelPolicy',
    ];

    /**
     * Register any authentication / authorization services.
     *
     * @return void
     */
    public function boot()
    {
        $this->registerPolicies();

        Passport::routes();
    }
}
```

#### 3.6 Configurar el driver de autenticación

En el archivo **config/auth.php**, debemos configurar la opción del **driver** de autenticación del **API**. Esto le indicará a nuestra aplicación que use **TokenGuard** al autenticar las solicitudes de API entrantes.

```php
'guards' => [
    'web' => [
        'driver' => 'session',
        'provider' => 'users',
    ],

    'api' => [
        'driver' => 'passport',
        'provider' => 'users',
    ],
],
```

### 4. Crear las rutas de autenticación de nuestro API

Crearemos las rutas de autenticación de nuestro API en el archivo **routes/api.php** que Laravel nos provee.

```php
<?php
use Illuminate\Http\Request;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::group(['prefix' => 'auth'], function () {
    Route::post('login', 'Api\AuthController@login');
    Route::post('register', 'Api\AuthController@register');

    Route::group(['middleware' => 'auth:api'], function() {
        Route::get('logout', 'Api\AuthController@logout');
        Route::get('user', 'Api\AuthController@user');
    });
});
```

### 5. Crear el controlador de autenticación

Crearemos el controlador que contendrá la lógica de autenticación.

```
php artisan make:controller Api\AuthController
```

### 6. Escribir la lógica de autenticación

Escribimos el siguiente código dentro de nuestro controlador **app/Http/Controllers/Api/AuthController.php**

```php
<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;
use App\User;

class AuthController extends Controller
{
    /**
     * Handle a register request to the application.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function register(Request $request)
    {
        $request->validate([
            'name'     => 'required|string',
            'email'    => 'required|string|email|unique:users',
            'password' => 'required|string|confirmed|min:6',
        ]);

        $user = new User([
            'name'              => $request->name,
            'email'             => $request->email,
            'password'          => \Hash::make($request->password),
        ]);

        $user->save();

        return response()->json(['message' => 'Se ha registrado el usuario exitosamente.'], 201);
    }

    /**
     * Handle a login request to the application.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function login(Request $request)
    {
        $request->validate([
            'email'       => 'required|string|email',
            'password'    => 'required|string|min:6',
        ]);

        $credentials = request(['email', 'password']);

        if (!Auth::attempt($credentials)) {
            return response()->json(['message' => trans('auth.failed')], 401);
        }

        $user = $request->user();
        $tokenResult = $user->createToken('Personal Access Token');
        $token = $tokenResult->token;

        if ($request->remember_me) {
            $token->expires_at = Carbon::now()->addWeeks(1);
        }

        $token->save();

        return response()->json([
            'access_token' => $tokenResult->accessToken,
            'token_type'   => 'Bearer',
            'expires_at'   => Carbon::parse($tokenResult->token->expires_at)->toDateTimeString(),
        ]);
    }

    /**
     * Handle a logout request to the application.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function logout(Request $request)
    {
        $request->user()->token()->revoke();

        return response()->json(['message' => 'Has cerrado la sesión exitosamente.']);
    }

    /**
     * Return the information of the logged user.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function user(Request $request)
    {
        return response()->json($request->user());
    }
}
```

### 7. Ejecutar la aplicación

Ejecutaremos nuestra aplicación para probar lo que hemos realizado.

```
php artisan serve
```

### 7. Probar la aplicación

Ahora podemos probar los endpoints con [Curl](https://curl.haxx.se/), [Postman](https://www.getpostman.com/) o alguna otra herramienta, en mi caso usaré [Insomnia](https://insomnia.rest/).

Debemos configurar las siguientes cabeceras para realizar las peticiones de manera correcta:
